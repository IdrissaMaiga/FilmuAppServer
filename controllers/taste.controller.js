import prismaclient from '../lib/prisma.js'
import updateAField from '../functions/fieldUpdate.js'

// Create a new taste
export const createTaste = async (req, res) => {
  try {
    const { name } = req.body
    const userId = req.user.id // Assuming user ID is stored in req.user

    // Check if the user already has a taste
    const existingTaste = await prismaclient.taste.findFirst({
      where: { userId }
    })

    if (existingTaste) {
      return res.status(400).json({ message: 'User already has a taste' })
    }

    // Create the new taste
    const newTaste = await prismaclient.taste.create({
      data: {
        name: name || 'mylist',
        userId
      }
    })

    res.status(201).json({
      message: 'Taste created successfully',
      taste: newTaste
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to create taste' })
  }
}
// Get the taste of the logged-in user
export const getTaste = async (req, res) => {
  try {
  
    const loggedInUserId = req.user.id // Logged-in user ID
 
    // Check if the logged-in user is an admin
    const existingTaste = await prismaclient.taste.findFirst({
      where: { userId: loggedInUserId }
    })

    if (!existingTaste) {
       await prismaclient.taste.create({
        data: {
          name:'Ma liste',
          userId:loggedInUserId
        }
      })
    }

    // Create the new taste
    

    // Determine the user ID to update based on admin sta

    // Fetch the taste for the logged-in user including related movieorseries
    const taste = await prismaclient.taste.findUnique({
      where: { userId: loggedInUserId },
      include:  { Movies: true, Series: true } // Include movieorseries details
    })

    if (!taste) {
      return res.status(404).json({ message: 'Taste not found for the user' })
    }

    res.status(200).json(taste)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to fetch taste' })
  }
}
export const checkTaste = async (req, res) => {
  try {
    const { id, type } = req.query; // Get ID and type (movie or series) from query parameters
    const userId = req.user.id; // Assuming user ID is available in req.user

    // Validate that `type` is either "movie" or "series"
    if (!['movie', 'series'].includes(type)) {
      return res.status(400).json({ message: 'Invalid type. Use "movie" or "series".' });
    }

    // Check if ID is provided
    if (!id) {
      return res.status(400).json({ message: 'ID is required.' });
    }
   console.log()
    // Fetch the user's taste list
    const userTaste = await prismaclient.taste.findUnique({
      where: { userId },
      select: {
        MovieIds: true,
        SerieIds: true,
      },
    });
   
    // Return false if the taste list does not exist for the user
    if (!userTaste) {
      return res.status(200).json({ inTaste: false });
    }
    //console.log(userTaste)
    // Check if the item is in the user's taste list
    const inTaste = type === 'movie'
      ? userTaste.MovieIds.includes(id)
      : userTaste.SerieIds.includes(id);

    // Respond with true or false based on the result
    res.status(200).json({ inTaste });
  } catch (error) {
    console.error("Error checking taste:", error);
    res.status(500).json({ message: 'Failed to check taste' });
  }
};



export const addOrDeleteTaste = async (req, res) => {
  try {
    const { movieId, seriesId, inOut } = req.body;
    const userId = req.user.id; // Assume user ID is stored in req.user

    // Ensure only movieId or seriesId is provided, not both or neither
    if ((movieId && seriesId) || (!movieId && !seriesId)) {
      return res.status(400).json({ message: 'Provide either movieId or seriesId, but not both' });
    }

    // Check if user already has a taste list; if not, create one
    let userTaste = await prismaclient.taste.findUnique({ where: { userId } });
    if (!userTaste) {
      userTaste = await prismaclient.taste.create({
        data: {
          name: 'Ma liste',
          userId,
        },
      });
    }

    // Retrieve user's taste list with movie and series IDs
    userTaste = await prismaclient.taste.findUnique({
      where: { userId },
      select: {
        id: true,
        MovieIds: true,
        SerieIds: true,
        Series: true,
        Movies: true,
      },
    });

    if (!userTaste) {
      return res.status(404).json({ message: 'Taste list not found for the user' });
    }

    // Add or remove a movie from the user's taste list
    if (movieId) {
      const movieExists = await prismaclient.movie.findUnique({ where: { id: movieId } });
      if (!movieExists) {
        return res.status(404).json({ message: 'Movie not found in database' });
      }

      const isMovieInTaste = userTaste.MovieIds.includes(movieId);
      if (isMovieInTaste && inOut) {
        return res.status(400).json({ message: 'Movie is already in your taste list' });
      }
      if (!inOut && !isMovieInTaste) {
        return res.status(400).json({ message: 'Movie is not in your taste list' });
      }

      const updatedMovieIds = inOut
        ? [...userTaste.MovieIds, movieId]
        : userTaste.MovieIds.filter(id => id !== movieId);

      await prismaclient.taste.update({
        where: { userId },
        data: { MovieIds: { set: updatedMovieIds } },
      });

      await prismaclient.movie.update({
        where: { id: movieId },
        data: {
          tasteIds: inOut
            ? { push: userTaste.id }
            : { set: movieExists.tasteIds.filter(id => id !== userTaste.id) },
        },
      });

      return res.status(200).json({
        message: `Movie ${inOut ? 'added to' : 'removed from'} taste list successfully`,
      });
    }

    // Add or remove a series from the user's taste list
    if (seriesId) {
      const seriesExists = await prismaclient.series.findUnique({ where: { id: seriesId } });
      if (!seriesExists) {
        return res.status(404).json({ message: 'Series not found in database' });
      }

      const isSeriesInTaste = userTaste.SerieIds.includes(seriesId);
      if (isSeriesInTaste && inOut) {
        return res.status(400).json({ message: 'Series is already in your taste list' });
      }
      if (!inOut && !isSeriesInTaste) {
        return res.status(400).json({ message: 'Series is not in your taste list' });
      }

      const updatedSerieIds = inOut
        ? [...userTaste.SerieIds, seriesId]
        : userTaste.SerieIds.filter(id => id !== seriesId);

      await prismaclient.taste.update({
        where: { userId },
        data: { SerieIds: { set: updatedSerieIds } },
      });

      await prismaclient.series.update({
        where: { id: seriesId },
        data: {
          tasteIds: inOut
            ? { push: userTaste.id }
            : { set: seriesExists.tasteIds.filter(id => id !== userTaste.id) },
        },
      });

      return res.status(200).json({
        message: `Series ${inOut ? 'added to' : 'removed from'} taste list successfully`,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update taste list' });
  }
};

// Update the taste of a user (either the logged-in user or another user if admin)
export const updateTaste = async (req, res) => {
  try {
    const { userId } = req.params // User ID to update (for admin use)
    const loggedInUserId = req.user.id // Logged-in user ID
    const { fieldName, fieldValue } = req.body

    // Check if the logged-in user is an admin
    const isAdmin = req.isAdmin

    // Determine the user ID to update based on admin status
    const targetUserId = isAdmin ? userId : loggedInUserId

    // Fetch the existing taste for the specified user
    const existingTaste = await prismaclient.taste.findFirst({
      where: { userId: targetUserId }
    })

    if (!existingTaste) {
      return res.status(404).json({ message: 'Taste not found for the user' })
    }
    if (
      
      fieldName !== 'name' &&
      fieldName !== 'SerieIds' &&
      fieldName !== 'MovieIds'
    ) {
      return res.status(403).json({ message: 'Unauthorized endpoint' })
    }

    // Update the existing taste using the generic function
    const updatedTaste = await updateAField(
      'taste',
      { userId: targetUserId },
      fieldName,
      fieldValue
    )

    res.status(200).json({
      message: 'Taste updated successfully',
      taste: updatedTaste
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to update taste' })
  }
}

// Delete the taste of the logged-in user
export const deleteTaste = async (req, res) => {
  try {
    const { userId } = req.params // User ID to update (for admin use)
    const loggedInUserId = req.user.id // Logged-in user ID

    // Check if the logged-in user is an admin
    const isAdmin = req.isAdmin

    // Determine the user ID to update based on admin status
    const targetUserId = isAdmin ? userId : loggedInUserId

    // Fetch the existing taste for the specified user

    // Fetch the taste for the logged-in user
    const existingTaste = await prismaclient.taste.findFirst({
      where: { userId: targetUserId }
    })

    if (!existingTaste) {
      return res.status(404).json({ message: 'Taste not found for the user' })
    }

    // Delete the taste
    await prismaclient.taste.delete({
      where: { userId: targetUserId }
    })

    res.status(200).json({ message: 'Taste deleted successfully' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to delete taste' })
  }
}

// Get all tastes (for admin use)
export const getAllTastes = async (req, res) => {
  try {
    const { selections } = req.body
    // Check if the logged-in user is an admin
    const isAdmin = req.isAdmin

    if (!isAdmin) {
      return res
        .status(403)
        .json({ message: 'Unauthorized: Only admins can access this endpoint' })
    }

    // Fetch all tastes including related movieorseries
    const allTastes = await prismaclient.taste.findMany({
      include: selections
    })

    res.status(200).json(allTastes)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to fetch tastes' })
  }
}
