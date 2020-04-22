const express = require('express')
const NotesService = require('./notes-service')
const path = require('path')
const xss = require('xss')
const notesRouter = express.Router()
const jsonParser = express.json()

const serializeNote = note => ({
  id: note.id,
  name: xss(note.name),
  content: xss(note.content),
  modified: note.modified,
  folderId: note.folderId
})
notesRouter 
  .route('/')
  .get((req, res, next) => {
    NotesService.getAllNotes(req.app.get('db'))
      .then(notes => {
        res.json(notes.map(serializeNote))
      })
      .catch(next)
  })
  .post(jsonParser, (req, res, next) => {
    const { name, content, folderId } = req.body
    const newNote = { name, content, folderId }

    for (const [key, value] of Object.entries(newNote)) {
      if (value == null || value.trim() == "") {
        return res.status(400).json({
          error: { message: `Missing '${key}' in request body` }
        })
      }
    }

    NotesService.insertNote(
      req.app.get('db'),
      newNote
    )
      .then(note => {
        res
          .status(201)
          .location(path.posix.join(req.originalUrl, `/${note.id}`))
          .json(serializeNote(note))
      })
      .catch(next)
  })

  notesRouter
    .route('/:note_id')
    .all((req, res, next) => {
      NotesService.getById(
        req.app.get('db'),
        req.params.note_id
      )
        .then(note => {
          if (!note) {
            return res.status(404).json({
              error: { message: `Note doesn't exist` }
            })
          }
          res.note = note
          next()
        })
        .catch(next)
    })
    .get((req, res, next) => {
      res.json(serializeNote(res.note))
    })
    .delete((req, res, next) => {
      NotesService.deleteNote(
        req.app.get('db'),
        req.params.note_id
      )
        .then(() => {
          res.status(204).end()
        })
        .catch(next)
    })
    .patch(jsonParser, (req, res, next) => {
      const { name, content, folderId } = req.body
      const newNoteData = { name, content, folderId }

      const numberOfValues = Object.values(newNoteData)
      if (numberOfValues === 0) {
        return res.status(400).json({
          error: { message: `Request body must contain either 'name', 'content', or 'folderId'` }
        })
      }

      NotesService.updateNote(
        req.app.get('db'), 
        req.params.note_id, 
        newNoteData
      )
        .then(numRowsAffected => {
          res.status(204).end()
        })
        .catch(next)
    })

module.exports = notesRouter