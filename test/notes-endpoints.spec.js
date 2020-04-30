const { expect } = require('chai');
const knex = require('knex');
const app = require('../src/app')
const { makeFoldersArray, makeNotesArray, makeMaliciousNote, makeSanitizedNote } = require('./notes_folders.fixtures')

describe('Notes Endpoints', function() {
  let db;
  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DATABASE_URL
    })
    app.set('db', db)
  })

  after('disconnect from db', () => db.destroy())

  before('clean up the table', () => db.raw('TRUNCATE notes, folders RESTART IDENTITY CASCADE'))

  afterEach('cleanup',  () => db.raw('TRUNCATE notes, folders RESTART IDENTITY CASCADE'))
  
  describe(`GET /api/notes`, () => {
    context(`Given no notes`, () => {
      it(`responds with 200 and an empty list`, () => {
        return supertest(app)
          .get('/api/notes')
          .expect(200, [])
      })
    })

    context(`Given there are notes in the database`, () => {
      const testFolders = makeFoldersArray()
      const testNotes = makeNotesArray()
      beforeEach('insert notes', () => {
        return db
          .into('folders')
          .insert(testFolders)
          .then(() => {
            return db
              .into('notes')
              .insert(testNotes)
          })
      })

      it('responds with 200 and all of the notes', () => {
        return supertest(app)
          .get('/api/notes')
          .expect(200, testNotes)
      })
    })

    context(`Given one of the notes in the database contains XSS attack`, () => {
      const maliciousNote = makeMaliciousNote()
      const expectedNote = makeSanitizedNote()
      const testFolders = makeFoldersArray()

      beforeEach('insert the malicious note', () => {
        return db
          .into('folders')
          .insert(testFolders)
          .then(() => {
            return db
              .into('notes')
              .insert(maliciousNote)
          })
      })

      it('sanitizes any malicious content', () => {
        return supertest(app)
          .get('/api/notes')
          .expect(200)
          .expect(res => {
            expect(res.body[0].name).to.eql(expectedNote.name)
            expect(res.body[0].content).to.eql(expectedNote.content)
          })
      })
    })
  })

  describe(`GET /api/notes/:note_id`, () => {
    context(`Given no note exists`, () => {
      it('responds with 404', () => {
        const noteId = "13e90aae-c6b3-43b9-99e6-30b355de0c42"
        return supertest(app)
          .get(`/api/notes/${noteId}`)
          .expect(404, { error: { message: `Note doesn't exist` }})
      })
    })

    context(`Given the note exists in the database`, () => {
      const testFolders = makeFoldersArray()
      const testNotes = makeNotesArray()
      beforeEach('insert notes', () => {
        return db
          .into('folders')
          .insert(testFolders)
          .then(() => {
            return db
              .into('notes')
              .insert(testNotes)
          })
      })

      it('responds with 200 and the specified note', () => {
        const noteId = "d26e01a6-ffaf-11e8-8eb2-f2801f1b9fd1"
        const expectedNote = testNotes.find(note => note.id === noteId)
        return supertest(app)
          .get(`/api/notes/${noteId}`)
          .expect(200, expectedNote)
      })
    })

    context(`Given the note contains XSS attack`, () => {
      const maliciousNote = makeMaliciousNote()
      const expectedNote = makeSanitizedNote()
      const testFolders = makeFoldersArray()

      beforeEach('insert the malicious note', () => {
        return db
          .into('folders')
          .insert(testFolders)
          .then(() => {
            return db
              .into('notes')
              .insert(maliciousNote)
          })
      })

      it('sanitizes any malicious content', () => {
        return supertest(app)
          .get(`/api/notes/${maliciousNote.id}`)
          .expect(200)
          .expect(res => {
            expect(res.body.name).to.eql(expectedNote.name)
            expect(res.body.content).to.eql(expectedNote.content)
          })
      })
    })
  })

  describe('POST /api/notes', () => {
    const testFolders = makeFoldersArray()
    beforeEach('insert folders', () => {
      return db
        .into('folders')
        .insert(testFolders)
    })

    context('Given all required fields are filled out', () => {
      it('creates a note, responding with 201 and the new note', () => {
        this.retries(3)
        const newNote = {
          name: 'Test new note',
          content: 'New test note content...',
          folder: 'b0715efe-ffaf-11e8-8eb2-f2801f1b9fd1'
        }
        return supertest(app)
          .post('/api/notes')
          .send(newNote)
          .expect(201)
          .expect(res => {
            expect(res.body.name).to.eql(newNote.name)
            expect(res.body.folder).to.eql(newNote.folder)
            expect(res.body.content).to.eql(newNote.content)
            expect(res.body).to.have.property('id')
            expect(res.body).to.have.property('modified')
            expect(res.headers.location).to.eql(`/api/notes/${res.body.id}`)
            const expectedDate = new Date().toLocaleString()
            const actualDate = new Date(res.body.modified).toLocaleString()
            expect(actualDate).to.eql(expectedDate)
          })
          .then(postRes => 
            supertest(app)
              .get(`/api/notes/${postRes.body.id}`)
              .expect(postRes.body)
          )
      })
    })
  
    context('A required field is missing from the posted note', () => {
      const requiredFields = ['name', 'folder', 'content']

      requiredFields.forEach(field => {
        const newNote = {
          name: 'Test new note',
          folder: 'b0715efe-ffaf-11e8-8eb2-f2801f1b9fd1',
          content: 'Testing new note content...'
        }

        it(`responds with 400 and an error message when the '${field}' is missing`, () => {
          delete newNote[field]

          return supertest(app)
            .post('/api/notes')
            .send(newNote)
            .expect( 400, {
              error: { message: `Missing '${field}' in request body` }
            })
        })
      })
    })
  })

  describe(`DELETE /api/notes/:note_id`, () => {
    context('Given the note is in the database', () => {
      const testNotes = makeNotesArray()
      const testFolders = makeFoldersArray()

      beforeEach('insert folders and notes', () => {
        return db
          .into('folders')
          .insert(testFolders)
          .then(() => {
            return db
              .into('notes')
              .insert(testNotes)
          })
      })

      it('responds with 204 and removes the specified note', () => {
        const idToRemove = "d26e0034-ffaf-11e8-8eb2-f2801f1b9fd1"
        const expectedNotes = testNotes.filter(note => note.id !== idToRemove)
        return supertest(app)
          .delete(`/api/notes/${idToRemove}`)
          .expect(204)
          .then(res => 
            supertest(app)
              .get(`/api/notes`)
              .expect(expectedNotes)
          )
      })
    })

    context(`Given the note doesn't exist`, () => {
      it('responds with 404', () => {
        const noteId = "13e90aae-c6b3-43b9-99e6-30b355de0c42"
        return supertest(app)
          .delete(`/api/notes/${noteId}`)
          .expect(404, { error: { message: `Note doesn't exist`}})
      })
    })
  })

  describe(`PATCH /api/notes/:note_id`, () => {
    context(`Given the specified note doesn't exist`, () => {
      it('responds with 404', () => {
        const noteId = "13e90aae-c6b3-43b9-99e6-30b355de0c42"
        return supertest(app)
          .delete(`/api/notes/${noteId}`)
          .expect(404, { error: { message: `Note doesn't exist`}})
      })
    })

    context(`Given the note exists in the database`, () => {
      const testNotes = makeNotesArray()
      const testFolders = makeFoldersArray()

      beforeEach('insert folders and notes', () => {
        return db
          .into('folders')
          .insert(testFolders)
          .then(() => {
            return db
              .into('notes')
              .insert(testNotes)
          })
      })

      it('responds with 204 and updates the specified note', () => {
        const idToUpdate = "d26e0034-ffaf-11e8-8eb2-f2801f1b9fd1"
        const updateNote = {
          name: 'updated note name',
          content: 'updated note content',
          folder: 'b0715efe-ffaf-11e8-8eb2-f2801f1b9fd1'
        }
        const expectedNote = {
          ...testNotes.find(note => note.id === idToUpdate),
          ...updateNote
        }

        return supertest(app)
          .patch(`/api/notes/${idToUpdate}`)
          .send(updateNote)
          .expect(204)
          .then(res => 
            supertest(app)
              .get(`/api/notes/${idToUpdate}`)
              .expect(expectedNote)
          )
      })

      it(`responds with 400 when no required fields supplied`, () => {
        const idToUpdate = "d26e0034-ffaf-11e8-8eb2-f2801f1b9fd1"
        return supertest(app)
          .patch(`/api/notes/${idToUpdate}`)
          .send({ irrelevantField: 'foo' })
          .expect(400, {
            error: {
              message: `Request body must contain either 'name', 'content', or 'folder'`
            }
          })
      })

      it(`responds with 204 when updating only a subset of fields`, () => {
        const idToUpdate = "d26e0034-ffaf-11e8-8eb2-f2801f1b9fd1"
        const updateNote = {
          name: 'updated note name'
        }
        const expectedNote = {
          ...testNotes.find(note => note.id === idToUpdate),
          ...updateNote
        }

        return supertest(app)
          .patch(`/api/notes/${idToUpdate}`)
          .send({
            ...updateNote,
            fieldToIgnore: 'should not be in GET response'
          })
          .expect(204)
          .then(res => 
            supertest(app)
              .get(`/api/notes/${idToUpdate}`)
              .expect(expectedNote)
          )
      })
    })
  })
})