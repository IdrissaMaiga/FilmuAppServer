import prismaclient from '../lib/prisma.js'


// Create a new series
export const createSeries = async (req, res) => {
  try {
    // Load the series data from the request body
    const seriesArray = req.body.series;

    // Ensure each series has the correct data type for `serieId`
    const updatedSeriesArray = seriesArray.map(serie => ({
      ...serie,
      serieId: serie.serieId ? String(serie.serieId) : null, // Convert `serieId` to a string or null
    }));

    // Use Prisma's createMany to insert multiple records at once
    const createdSeries = await prismaclient.series.createMany({
      data: updatedSeriesArray,
    });

    res.status(201).json({
      message: 'Series created successfully in bulk',
      count: createdSeries.count,
    });
  } catch (error) {
    console.error('Error creating series in bulk:', error);
    res.status(500).json({
      message: 'Failed to create series in bulk',
      error: error.message,
    });
  }
};


export const getSeries = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const isRandom = req.query.random === 'true';
    const genreFilter = req.query.genre || ""; // Genre to filter by
   // console.log(genreFilter);

    // Use Prisma's `has` for filtering array fields
    const genreCondition = genreFilter
      ? { genres: { has: genreFilter } }
      : {};

    if (isRandom) {
      // Random mode: Fetch random series
      const series = await prismaclient.series.aggregateRaw({
        pipeline: [
          { $match: { tmdb: { $ne: null }, ...genreCondition } },
          { $sample: { size: pageSize * 2 } }, // Sample a larger pool to handle duplicates
        ],
      });

      const uniqueSeries = [];
      const seenTmdbIds = new Set();
      const seenImagePaths = new Set();

      for (const serie of series) {
        const { tmdb, imagePath } = serie;

        // Check for uniqueness based on tmdb and imagePath
        if (tmdb && imagePath && !seenTmdbIds.has(tmdb) && !seenImagePaths.has(imagePath)) {
          uniqueSeries.push(serie);
          seenTmdbIds.add(tmdb);
          seenImagePaths.add(imagePath);
        }

        // Stop once we have the desired pageSize
        if (uniqueSeries.length === pageSize) break;
      }

      res.status(200).json({
        series: uniqueSeries,
        pageSize,
        totalSeries: uniqueSeries.length,
      });
    } else {
      // Normal pagination mode
      const skip = (page - 1) * pageSize;
      const series = await prismaclient.series.findMany({
        skip,
        take: pageSize,
        where: {
          tmdb: { not: null },
          ...genreCondition, // Use Prisma's has operator
        },
        orderBy: { published: 'desc' },
      });

      // Ensure no duplicates in normal pagination
      const uniqueSeries = [];
      const seenTmdbIds = new Set();
      const seenImagePaths = new Set();

      for (const serie of series) {
        const { tmdb, imagePath } = serie;

        // Check for uniqueness based on tmdb and imagePath
        if (tmdb && imagePath && !seenTmdbIds.has(tmdb) && !seenImagePaths.has(imagePath)) {
          uniqueSeries.push(serie);
          seenTmdbIds.add(tmdb);
          seenImagePaths.add(imagePath);
        }
      }

      // Fetch the total number of series with non-null tmdb
      const totalSeries = await prismaclient.series.count({
        where: {
          tmdb: { not: null },
          ...genreCondition,
        },
      });

      res.status(200).json({
        series: uniqueSeries,
        page,
        pageSize,
        totalSeries,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch series' });
  }
};



export const getSeriesByTmdb = async (req, res) => {
  try {
    const { tmdb, imagePath } = req.body;

    // Fetch series based on `tmdb` or `imagePath` parameters
    const series = await prismaclient.series.findMany({
      where: {
        OR: [
          { tmdb: tmdb || undefined },
          { imagePath: imagePath || undefined },
        ],
      }
    });

    if (!series || series.length === 0) {
      return res.status(404).json({ message: 'Series not found' });
    }

    // Function to determine uniqueness based on fields
    const isDuplicate = (a, b) => (
      a.id === b.id
    );

    // Remove duplicates based on specified fields
    const uniqueSeries = series.filter((serie, index, self) => 
      index === self.findIndex((s) => isDuplicate(serie, s))
    );

   
    
    res.status(200).json(uniqueSeries);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch series' });
  }
};



export const getMoviesAndSeries = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 24;
    const searchQuery = req.query.search || ''; // Search term
    const genresQuery = req.query.genres ? req.query.genres.split(',') : []; // Parse genres query if available
    const isRandom = req.query.random === 'true'; // Random flag
    const type = req.query.type || 'all'; // Type could be 'movie', 'series', or 'all'

    const skip = (page - 1) * pageSize;

    let results = { movies: [], series: [] };
    let totalMovies = 0;
    let totalSeries = 0;

    // Build search condition based on searchQuery and genresQuery
    const searchCondition = {
      AND: [
        { name: { contains: searchQuery, mode: 'insensitive' } },
        ...(genresQuery.length > 0
          ? [{ genres: { hasSome: genresQuery, mode: 'insensitive' } }] // Search for genres if specified
          : []),
      ],
    };

    // Function to filter out duplicates based on tmdb and imagePath
    const filterDuplicates = (items) => {
      const seenTmdbIds = new Set();
      const seenImagePaths = new Set();
      return items.filter(item => {
        const { tmdb, imagePath } = item;
        const isTmdbDuplicate = tmdb && seenTmdbIds.has(tmdb);
        const isImagePathDuplicate = imagePath && seenImagePaths.has(imagePath);

        // If it's a duplicate, skip it
        if (isTmdbDuplicate || isImagePathDuplicate) {
          return false;
        }

        // Otherwise, add to the sets
        if (tmdb) seenTmdbIds.add(tmdb);
        if (imagePath) seenImagePaths.add(imagePath);

        return true;
      });
    };

    // Fetch and filter movies based on search query and genres
    if (type === 'movie' || type === 'all') {
      const moviesQuery = {
        where: searchCondition,
        skip,
        take: pageSize,
        orderBy: { tmdb: 'desc' },
      };

      results.movies = await prismaclient.movie.findMany(moviesQuery);
      totalMovies = await prismaclient.movie.count({ where: searchCondition });

      // Filter out duplicates for movies
      results.movies = filterDuplicates(results.movies);
    }

    // Fetch and filter series based on search query and genres
    if (type === 'series' || type === 'all') {
      const seriesQuery = {
        where: searchCondition,
        skip,
        take: pageSize,
        orderBy: { tmdb: 'desc' },
      };

      results.series = await prismaclient.series.findMany(seriesQuery);
      totalSeries = await prismaclient.series.count({ where: searchCondition });

      // Filter out duplicates for series
      results.series = filterDuplicates(results.series);
    }

    // If random mode is enabled, shuffle the results
    if (isRandom) {
      if (type === 'movie' || type === 'all') {
        results.movies = results.movies.sort(() => Math.random() - 0.5); // Simple shuffle
      }
      if (type === 'series' || type === 'all') {
        results.series = results.series.sort(() => Math.random() - 0.5); // Simple shuffle
      }
    }

    res.status(200).json({
      results,
      totalMovies,
      totalSeries,
      page,
      pageSize,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch movies and series' });
  }
};


// Backend: Route handler for fetching movies and series by IDs
export const getMovieandseriesByIds = async (req, res) => {
  try {
    const { movieIds, seriesIds } = req.body; // Accept movie and series IDs in the request body
  if (!seriesIds&&!movieIds) return res.status(500).json({message:"no id are in the body"})
    // Fetch movies by their IDs
    let movies=[]
    if (movieIds)movies=await prismaclient.movie.findMany({
      where: { id: { in: movieIds } },
    });
    let series =[]
    if (seriesIds) series = await prismaclient.series.findMany({
      where: { id: { in: seriesIds } },
    });
    
    res.status(200).json({ data: [...movies, ...series] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch movies and series' });
  }
};
