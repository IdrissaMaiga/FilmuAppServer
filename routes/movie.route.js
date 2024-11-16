import express from 'express'
import {
 // createMovie,
  getMovies,
  //getMovieById,
  //updateMovie,
  //deleteMovie,
  getMoviesByTmdb,
  createMovies
} from '../controllers/movie.controller.js'
import authenticateToken from '../middleware/verifyToken.js'
import { isAdmin } from '../middleware/verifyAdmin.js'

const movieRoute = express.Router()
movieRoute.post('', authenticateToken, isAdmin, createMovies)
movieRoute.get('', authenticateToken, getMovies)
movieRoute.post('/byquery', authenticateToken, getMoviesByTmdb)









// Route to create a new movie (POST /api)
//movieRoute.post('', authenticateToken, isAdmin, createMovie)
// Route to update a specific movie by ID (PUT /api/:id)
//movieRoute.put(
//  '/:id',
 // authenticateToken,
 // isAdmin,
 // updateMovie
//)
// Route to delete a specific movie by ID (DELETE /api/:id)
//movieRoute.delete('/:id', authenticateToken, isAdmin, deleteMovie)


export default movieRoute
