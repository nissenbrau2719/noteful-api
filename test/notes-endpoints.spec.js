const { expect } = require('chai');
const knex = require('knex');
const app = require('../src/app')

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

  before('clean up the table', () => db.raw('TRUNCATE notes RESTART IDENTITY CASCADE'))

  afterEach('cleanup',  () => db.raw('TRUNCATE notes RESTART IDENTITY CASCADE'))
  
  describe(`GET /api/notes`, () => {
    context(`Given no notes`, () => {
      it(`responds with 200 and an empty list`, () => {
        return supertest(app)
          .get('/api/notes')
          .expect(200, [])
      })
    })
  })
})