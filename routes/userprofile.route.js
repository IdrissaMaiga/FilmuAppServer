import express from 'express';
import { 
  updateProfileField,
  getProfile,
  getUserAll,
  deleteUser,
  banUser,
  updateStreamingAccess,
  getActiveUsers,
  getBannedUsers,
  OffUser,
  requestPasswordReset, // Import password reset controller
  updatePassword, // Import password update controller
  getAgenAll,
  sendVerificationEmail,
  verifyEmailCode,
  flagDevice
} from '../controllers/userprofile.controller.js'; // Adjust path if necessary
import authenticateToken from '../middleware/verifyToken.js';
import { isAdmin } from '../middleware/verifyAdmin.js';


const profileRoute = express.Router();

// Route to get user profile
profileRoute.get('/profile', authenticateToken, getProfile);

// Route to update user profile field
profileRoute.put('/profile/updateField', authenticateToken, updateProfileField);


// Route to request password reset (send verification code)
profileRoute.post('/password-reset/request',  requestPasswordReset);
// Route to update password
profileRoute.patch('/password-reset/update', updatePassword);

//const { email,newPassword, code, phone } = req.body;
// to verify account and fist time subscription
profileRoute.patch('/confirmAccount', verifyEmailCode);
// to send a verification code to you email
profileRoute.post('/verifyemail', sendVerificationEmail);


//get all agents
profileRoute.get('/agents',getAgenAll);


// Route to get all users (admin only)
profileRoute.get('/users', authenticateToken, isAdmin, getUserAll);

// Route to get active users (admin only)
profileRoute.get('/activedusers', authenticateToken, isAdmin, getActiveUsers);

// Route to get banned users (admin only)
profileRoute.get('/bannedusers', authenticateToken, isAdmin, getBannedUsers);






// Route to delete a user (admin only)
profileRoute.delete('/user', authenticateToken, isAdmin, deleteUser);

// Route to ban a user (admin only)
profileRoute.patch('/user/ban', authenticateToken, isAdmin, banUser);

// Route to activate a user (admin only)
profileRoute.patch('/user/active', authenticateToken, isAdmin, OffUser);
// Route to update user profile field streaming access
profileRoute.put('/profile/updateStreamingAcess', authenticateToken, updateStreamingAccess);



profileRoute.patch('/flag', authenticateToken,flagDevice);
export default profileRoute;


