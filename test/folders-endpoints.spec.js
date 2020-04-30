const { expect } = require('chai');
const knex = require('knex');
const app = require('../src/app')
const { makeFoldersArray } = require('./notes_folders.fixtures')

describe.only('Folders Endpoints', function() {
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
  
  describe(`GET /api/folders`, () => {
    context(`Given no folders`, () => {
      it(`responds with 200 and an empty list`, () => {
        return supertest(app)
          .get('/api/folders')
          .expect(200, [])
      })
    })

    context(`Given there are folders in the database`, () => {
      const testFolders = makeFoldersArray()
      beforeEach('insert folders', () => {
        return db
          .into('folders')
          .insert(testFolders)
      })

      it('responds with 200 and all of the folders', () => {
        return supertest(app)
          .get('/api/folders')
          .expect(200, testFolders)
      })
    })
  })

  describe(`POST /api/folders`, () => {
    context('Given the required field is filled out', () => {
      it('creates a folder, responding with 201 and the new folder', () => {
        this.retries(3)
        const newFolder = { name: 'New folder' }
        return supertest(app)
          .post('/api/folders')
          .send(newFolder)
          .expect(201)
          .expect(res => {
            expect(res.body.name).to.eql(newFolder.name)
            expect(res.body).to.have.property('id')
            expect(res.headers.location).to.eql(`/api/folders/${res.body.id}`)
          })
      })
    })

    context('The name field is missing from the posted folder', () => {
      const newFolder = { name: "" }
      it(`responds with 400 and an error message when the name field is blank`, () => {
        return supertest(app)
          .post('/api/folders')
          .send(newFolder)
          .expect(400, {error: {message: "Missing folder name in request body"}})

      })
    })
  })

  describe(`GET /api/folders/:folder_id`, () => {
    context('Given no specified folder in the database', () => {
      it('responds with 404', () => {
        const folderId = "13e90aae-c6b3-43b9-99e6-30b355de0c42"
        return supertest(app)
          .get(`/api/folders/${folderId}`)
          .expect(404, {error: {message: "Folder doesn't exist"}})
      })
    })

    context('Given the folder exists in the database', () => {
      const testFolders = makeFoldersArray()
      beforeEach('insert folders', () => {
        return db
          .into('folders')
          .insert(testFolders)
      })

      it('responds with 400 and the specified folder', () => {
        const folderId = "b07162f0-ffaf-11e8-8eb2-f2801f1b9fd1"
        const expectedFolder = testFolders.find(folder => folder.id === folderId)
        return supertest(app)
          .get(`/api/folders/${folderId}`)
          .expect(200, expectedFolder)
      })
    })
  })

  describe(`PATCH /api/folders/:folder_id`, () => {
    context('Given no specified folder in the database', () => {
      it('responds with 404', () => {
        const folderId = "13e90aae-c6b3-43b9-99e6-30b355de0c42"
        return supertest(app)
          .patch(`/api/folders/${folderId}`)
          .send({name: 'updated folder name'})
          .expect(404, {error: {message: "Folder doesn't exist"}})
      })
    })

    context(`Given the specified folder exists in the database`, () => {
      const testFolders = makeFoldersArray()
      beforeEach(`insert folders`, () => {
        return db 
          .into('folders')
          .insert(testFolders)
      })

      it('responds with 204 and updates the specified folder', () => {
      const idToUpdate = "b07162f0-ffaf-11e8-8eb2-f2801f1b9fd1"
      const updateFolder = {
        name: 'updated folder name'
      }
      const expectedFolder = {
        ...testFolders.find(folder => folder.id === idToUpdate),
        ...updateFolder
      }

      return supertest(app)
        .patch(`/api/folders/${idToUpdate}`)
        .send(updateFolder)
        .expect(204)
        .then(res => 
          supertest(app)
            .get(`/api/folders/${idToUpdate}`)
            .expect(expectedFolder)
        )
      })

      
      it(`responds with 400 and an error message when the name field is blank`, () => {
        const idToUpdate = "b07162f0-ffaf-11e8-8eb2-f2801f1b9fd1"
        const updateFolder = { name: ' ' }
        return supertest(app)
          .patch(`/api/folders/${idToUpdate}`)
          .send(updateFolder)
          .expect(400, {error: {message: "Request body must contain updated folder name"}})
  
      })

      it('responds with 204 and only updates relevent field', () => {
        const idToUpdate = "b07162f0-ffaf-11e8-8eb2-f2801f1b9fd1"
        const updateFolder = {
          name: 'updated folder name'
        }
        const expectedFolder = {
          ...testFolders.find(folder => folder.id === idToUpdate),
          ...updateFolder
        }
  
        return supertest(app)
          .patch(`/api/folders/${idToUpdate}`)
          .send({
            ...updateFolder,
            fieldToIgnore: 'should not be in GET response'            
          })
          .expect(204)
          .then(res => 
            supertest(app)
              .get(`/api/folders/${idToUpdate}`)
              .expect(expectedFolder)
          )
        })
    })
  })
    
  describe(`DELETE /api/folders/:folder_id`, () => {
    context('Given no specified folder in the database', () => {
      it('responds with 404', () => {
        const folderId = "13e90aae-c6b3-43b9-99e6-30b355de0c42"
        return supertest(app)
          .delete(`/api/folders/${folderId}`)
          .expect(404, {error: {message: "Folder doesn't exist"}})
      })
    })

    context(`Given the specified folder exists in the database`, () => {
      const testFolders = makeFoldersArray()
      beforeEach(`insert folders`, () => {
        return db 
          .into('folders')
          .insert(testFolders)
      })

      it('responds with 204 and deletes the specified folder', () => {
      const idToRemove = "b07162f0-ffaf-11e8-8eb2-f2801f1b9fd1"
      const expectedFolders = testFolders.filter(folder => folder.id !== idToRemove)     
      return supertest(app)
        .delete(`/api/folders/${idToRemove}`)
        .expect(204)
        .then(res => 
          supertest(app)
            .get(`/api/folders`)
            .expect(expectedFolders)
        )
      })
    })
  })
})
