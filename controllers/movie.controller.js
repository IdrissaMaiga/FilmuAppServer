import prismaclient from '../lib/prisma.js'
import updateAField from '../functions/fieldUpdate.js'
import { encrypt, decrypt } from '../lib/crypto.js';
// Create a new movie

export const createMovies = async (req, res) => {
  try {
    const { movies } = req.body; // Expecting an array of movies

    // Only allow admin to create movies
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Only admin can create movies' });
    }

    // Validate input: Ensure movies is an array and not empty
    if (!Array.isArray(movies) || movies.length === 0) {
      return res.status(400).json({ message: 'Please provide an array of movies' });
    }

    // Validate each movie object to ensure necessary fields are present
 
   
    // Use Prisma's createMany to insert multiple records at once
    const createdMovies = await prismaclient.movie.createMany({
      data: movies.map(({ name, indexer, isAdult, extension, tmdb, downloadPrice, imagePath, rating, added }) => ({
        name,
        indexer: encrypt(String(indexer)), // Encrypt the indexer here
        isAdult,
        extension,
        tmdb,
        downloadPrice,
        imagePath,
        rating,
        added: new Date(added), // Ensure it's a valid date
      }))
     // Optionally skip duplicates based on unique constraints
    });

    res.status(201).json({
      message: 'Movies created successfully',
      count: createdMovies.count, // Number of movies successfully created
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create movies' });
  }
};

export const getMovies = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const isRandom = req.query.random === 'true';
    const genreFilter = req.query.genre || ""; // Genre to filter by
   // console.log(genreFilter)
    // Use Prisma's `has` for filtering array fields
    const genreCondition = genreFilter
      ? { genres: { has: genreFilter} }
      : {};

    if (isRandom) {
      // Random mode: Fetch random movies
      const movies = await prismaclient.movie.aggregateRaw({
        pipeline: [
          { $match: { tmdb: { $ne: null }, ...genreCondition } },
          { $sample: { size: pageSize * 2 } }, // Sample a larger pool to handle duplicates
        ],
      });

      const uniqueMovies = [];
      const seenTmdbIds = new Set();
      const seenImagePaths = new Set();

      for (const movie of movies) {
        const { tmdb, imagePath } = movie;

        // Check for uniqueness based on tmdb and imagePath
        if (tmdb && imagePath && !seenTmdbIds.has(tmdb) && !seenImagePaths.has(imagePath)) {
          uniqueMovies.push(movie);
          seenTmdbIds.add(tmdb);
          seenImagePaths.add(imagePath);
        }

        // Stop once we have the desired pageSize
        if (uniqueMovies.length === pageSize) break;
      }

      res.status(200).json({
        movies: uniqueMovies,
        pageSize,
        totalMovies: uniqueMovies.length,
      });
    } else {
      // Normal pagination mode
      const skip = (page - 1) * pageSize;
      const movies = await prismaclient.movie.findMany({
        skip,
        take: pageSize,
        where: {
          tmdb: { not: null },
          ...genreCondition, // Use Prisma's has operator
        },
        orderBy: { added: 'desc' },
      });

      // Ensure no duplicates in normal pagination
      const uniqueMovies = [];
      const seenTmdbIds = new Set();
      const seenImagePaths = new Set();

      for (const movie of movies) {
        const { tmdb, imagePath } = movie;

        // Check for uniqueness based on tmdb and imagePath
        if (tmdb && imagePath && !seenTmdbIds.has(tmdb) && !seenImagePaths.has(imagePath)) {
          uniqueMovies.push(movie);
          seenTmdbIds.add(tmdb);
          seenImagePaths.add(imagePath);
        }
      }

      // Fetch the total number of movies with non-null tmdb
      const totalMovies = await prismaclient.movie.count({
        where: {
          tmdb: { not: null },
          ...genreCondition,
        },
      });

      res.status(200).json({
        movies: uniqueMovies,
        page,
        pageSize,
        totalMovies,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch movies' });
  }
};







//GetMoviesbytmdb 
// Get a movies by ID
export const getMoviesByTmdb = async (req, res) => {
  try {
    const { tmdb, imagePath } = req.body;

    // Fetch movies based on `tmdb` or `imagePath` parameters
    const movies = await prismaclient.movie.findMany({
      where: {
        OR: [
          { tmdb: tmdb || undefined },
          { imagePath: imagePath || undefined },
        ],
      }
    });

    if (!movies || movies.length === 0) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    // Function to determine uniqueness based on fields
    const isDuplicate = (a, b) => (

      a.id=== b.id
      
     
    );

    // Remove duplicates based on specified fields
    const uniqueMovies = movies.filter((movie, index, self) => 
      index === self.findIndex((m) => isDuplicate(movie, m))
    );
    const Movies = uniqueMovies.map((movie) => ({
      ...movie,
      indexer: decrypt(movie.indexer) // Create a new object with the decrypted `indexer`
    }));
    
    res.status(200).json(Movies);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch movie' });
  }
};


























































// Get a movie by ID
export const getMovieById = async (req, res) => {
  try {
    const { id } = req.params

    // Fetch the movie by ID
    const movie = await prismaclient.movie.findUnique({
      where: { id },
      include: {
        Tastes: {
          where: { userId: req.user.id }
        },
        Downloads: {
          where: {
            userId: req.user.id,
          }
        }, // User's confirmed downloads
        Watchings: {
          where: { userId: req.user.id }
        }
      }
    })

    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' })
    }

    res.status(200).json(movie)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to fetch movie' })
  }
}

export const createMovie = async (req, res) => {
  try {
    const { name,indexer,isAdult,extension,tmdb,downloadPrice } =
      req.body

    // Only allow admin to create movies
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Only admin can create a movie' })
    }

    const newMovie = await prismaclient.movie.create({
      data: { name,indexer,isAdult,extension,tmdb,downloadPrice }
    })

    res
      .status(201)
      .json({ message: 'Movie created successfully', movie: newMovie })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to create movie' })
  }
}
// Update a movie by ID
export const updateMovie = async (req, res) => {
  try {
    const { id } = req.params
    const { fieldName, fieldValue } = req.body

    // Only allow admin to update movies
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Only admin can update a movie' })
    }

    const updatedMovie = await updateAField(
      'movie',
      { id },
      fieldName,
      fieldValue
    )

    res.status(200).json({
      message: 'Movie updated successfully',
      movie: updatedMovie
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to update movie' })
  }
}

// Delete a movie by ID
export const deleteMovie = async (req, res) => {
  try {
    const { id } = req.params

    // Only allow admin to delete movies
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Only admin can delete a movie' })
    }

    await prismaclient.movie.delete({
      where: { id }
    })

    res.status(200).json({ message: 'Movie deleted successfully' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to delete movie' })
  }
}
