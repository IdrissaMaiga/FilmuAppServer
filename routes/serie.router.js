import express from 'express'
import {
  createSeries,
  getSeries,
  //getSeriesById,
  //updateSeries,
 // getSeriesofmylist,
 getMoviesAndSeries,
 getMovieandseriesByIds,
  getSeriesByTmdb
} from '../controllers/series.controller.js'
import { isAdmin } from '../middleware/verifyAdmin.js'
import authenticateToken from '../middleware/verifyToken.js'
const SerieRouter = express.Router()
SerieRouter.use(authenticateToken)

// POST /series - Create a new series (admin only)
SerieRouter.post('', isAdmin, createSeries)
SerieRouter.get('', getSeries)
SerieRouter.post('/byquery',getSeriesByTmdb)
SerieRouter.get('/all', getMoviesAndSeries)
SerieRouter.post('/byids',getMovieandseriesByIds)




//SerieRouter.get("/mylistseries/",getSeriesofmylist)
//SerieRouter.put('/:id', isAdmin, updateSeries)

export default SerieRouter
