import prismaclient from '../lib/prisma.js'
import updateAField from '../functions/fieldUpdate.js'

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

    if (isRandom) {
      // Random mode: Fetch a random selection of series
      const series = await prismaclient.series.aggregateRaw({
        pipeline: [
          { $match: { tmdb: { $ne: null } } },
          { $sample: { size: pageSize * 2 } }, // Sample a larger pool to account for possible duplicates
        ],
      });

      const uniqueSeries = [];
      const seenTmdbIds = new Set();
      const seenImagePaths = new Set();

      // Filter the series to avoid duplicates based on `tmdb` and `imagePath`
      for (const serie of series) {
        const { tmdb, imagePath } = serie;

        // Check for uniqueness based on `tmdb` and `imagePath`
        const isTmdbDuplicate = tmdb && seenTmdbIds.has(tmdb);
        const isImagePathDuplicate = imagePath && seenImagePaths.has(imagePath);

        if (!isTmdbDuplicate && !isImagePathDuplicate) {
          uniqueSeries.push(serie);

          // Track seen `tmdb` and `imagePath` values
          if (tmdb) seenTmdbIds.add(tmdb);
          if (imagePath) seenImagePaths.add(imagePath);
        }

        // Stop once we reach the desired pageSize
        if (uniqueSeries.length === pageSize) break;
      }

      // Send the filtered unique series in random mode
      res.status(200).json({
        series: uniqueSeries,
        pageSize,
        totalSeries: uniqueSeries.length,
      });

    } else {
      // Normal pagination mode
      const skip = (page - 1) * pageSize;

      // Fetch the series and ensure no duplicates in the results
      const series = await prismaclient.series.findMany({
        skip,
        take: pageSize,
        where: { tmdb: { not: null } },
        orderBy: { tmdb: "desc" },
      });

      // Filter out duplicates based on `tmdb` and `imagePath`
      const uniqueSeries = [];
      const seenTmdbIds = new Set();
      const seenImagePaths = new Set();

      for (const serie of series) {
        const { tmdb, imagePath } = serie;

        // Check for uniqueness based on `tmdb` and `imagePath`
        const isTmdbDuplicate = tmdb && seenTmdbIds.has(tmdb);
        const isImagePathDuplicate = imagePath && seenImagePaths.has(imagePath);

        if (!isTmdbDuplicate && !isImagePathDuplicate) {
          uniqueSeries.push(serie);

          // Track seen `tmdb` and `imagePath` values
          if (tmdb) seenTmdbIds.add(tmdb);
          if (imagePath) seenImagePaths.add(imagePath);
        }
      }

      // Fetch the total number of unique series
      const totalSeries = await prismaclient.series.count({
        where: { tmdb: { not: null } },
      });

      // Return the unique series in normal pagination mode
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
    const isRandom = req.query.random === 'true'; // Random flag
    const type = req.query.type || 'all'; // Type could be 'movie', 'series', or 'all'

    const skip = (page - 1) * pageSize;

    let results = { movies: [], series: [] };
    let totalMovies = 0;
    let totalSeries = 0;

    // Search query condition for movies and series
    const searchCondition = { name: { contains: searchQuery, mode: 'insensitive' } }

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

    // Fetch and filter movies based on search query
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

    // Fetch and filter series based on search query
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
















































// the series of the user taste
export const getSeriesofmylist = async (req, res) => {
  try {
    // Fetch all series for admin, only basic details for normal users
    series = await prismaclient.series.findMany({
      where: {
        tasteIds: { contains: req.user.taste.id } // Fetch only series that belong to the user's taste
      },
      select: {
        id: true,
        name: true,
        description: true,
        downloadPrice: true,
        type_: true,
        season: {
          select: {
            id: true,
            number: true,
            episodes: {
              select: {
                id: true,
                name: true,
                downloadPrice: true,
                paymentStatus: true,
                seenby: true,
                Downloads: {
                  where: {
                    OR: [
                      { adminconfirm: true, userId: req.user.id }, // Allow confirmed downloads by admin
                      {
                        userId: req.user.id, // Allow downloads by the logged-in user
                        clientconfirm: true
                      }
                    ]
                  }
                },
                Watching: {
                  where: {
                    userId: req.user.id // Allow downloads by the logged-in user
                  }
                }
              }
            }
          }
        }
      }
    })

    res.status(200).json(series)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to fetch series' })
  }
}
// Get a series by ID
export const getSeriesById = async (req, res) => {
  try {
    const { id } = req.params
    // Fetch the series by ID including episodes
    let serie
    if (req.isAdmin) {
      serie = await prismaclient.series.findUnique({
        where: { id },
        include: {
          season: {
            include: {
              episodes: {
                include: {
                  Downloads: true,
                  Watching: true
                }
              }
            }
          },
          Tastes: true
        }
      })
    } else {
      serie = await prismaclient.series.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          description: true,
          downloadPrice: true,
          type_: true,
          season: {
            select: {
              id: true,
              number: true,
              episodes: {
                select: {
                  id: true,
                  name: true,
                  downloadPrice: true,
                  paymentStatus: true,
                  seenby: true,
                  Downloads: {
                    where: {
                      OR: [
                        { adminconfirm: true, userId: req.user.id }, // Allow confirmed downloads by admin
                        {
                          userId: req.user.id, // Allow downloads by the logged-in user
                          clientconfirm: true
                        }
                      ]
                    }
                  },
                  Watching: {
                    where: {
                      userId: req.user.id // Allow downloads by the logged-in user
                    }
                  }
                }
              }
            }
          }
        }
      })
    }

    if (!serie) {
      return res.status(404).json({ message: 'Series not found' })
    }

    // Restrict access for normal users

    res.status(200).json(series)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to fetch series' })
  }
}

// Update a series by ID
export const updateSeries = async (req, res) => {
  try {
    const { id } = req.params
    const { fieldName, fieldValue } = req.body

    // Only allow admin to update series
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Only admin can update a series' })
    }

    const updatedSeries = await updateAField(
      'series',
      { id },
      fieldName,
      fieldValue
    )

    res.status(200).json({
      message: 'Series updated successfully',
      series: updatedSeries
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to update series' })
  }
}
