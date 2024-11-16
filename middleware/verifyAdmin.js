// authMiddleware.js

// Assume you have a function to retrieve user information from the request
// For example, req.user contains the current user's information

export const isAdmin = (req, res, next) => {
  // Check if the user exists and has the role of ADMIN
  
  if (req.isAdmin) {
    
    // User is an admin, allow access to the admin routes
    next()
  } else {
    // User is not an admin, deny access
    res.status(403).json({ message: 'Unauthorized: Admin  access required' })
  }
}
