import bcrypt from 'bcrypt'
import prismaclient from '../lib/prisma.js'
import { body, validationResult } from 'express-validator'
import updateAField from '../functions/fieldUpdate.js'
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import moment from 'moment';
import { isAdmin } from '../middleware/verifyAdmin.js';

// Validation middleware for password change
export const validatePasswordChange = [
  body('email').isEmail().withMessage('Invalid email format'),
  body('newPassword')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/)
    .withMessage('Password must be at least 8 characters long and contain at least one letter and one number'),
  body('code').optional().notEmpty().withMessage('Code cannot be empty')
];


// Request password reset (send verification code)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
});

//model verifyUser{
 /// id String  @id @default(auto()) @map("_id") @db.ObjectId
  //phonenumeber   String?
  //email          String @unique
  //isApproved     Boolean?
  //verificationCode     String?
  //codeExpiresAt        DateTime?
//}
// Controller for sending verification email to potential clients
export const sendVerificationEmail = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email } = req.body;

  try {
    // Find the potential client by email
    let client = await prismaclient.verifyUser.findUnique({ where: { email } });
    let client1 = await prismaclient.user.findUnique({ where: { email } });
    if (client1){
      return res.status(400).json({ message: 'User already Have an account with us' });
    }

    if (!client) {
       client = await prismaclient.verifyUser.create({
        data: {
          email,
          isApproved: true, // Set default as not approved until verification
        },
      });
      
    }

    // Generate a random verification code
    const code = crypto.randomBytes(3).toString('hex');
    const expiresAt = moment().add(10, 'minutes').toISOString();

    // Save code and expiration in the database
    await prismaclient.verifyUser.update({
      where: { email },
      data: { verificationCode: code, codeExpiresAt: expiresAt },
    });
 
    //${year} Filmu.
    // Email content with Netflix-style HTML
 

    const year = new Date().getFullYear();


const emailHTML = `
  <div style="background-color: #141414; padding: 20px; color: white; font-family: Arial, sans-serif; text-align: center; width: 100%; box-sizing: border-box;">
    
    <!-- Logo -->
    <div style="margin-bottom: 20px; text-align: center;">
      <img src="https://i.postimg.cc/cJmbLVSV/filmulogo-1.png" alt="Votre Logo" style="width: 120px; height: auto; border-radius: 8px; max-width: 100%;" />
    </div>
    
    <!-- Main Content -->
    <div style="background-color: #222222; padding: 20px; border-radius: 8px; text-align: center; width: 100%; max-width: 600px; margin: 0 auto; box-sizing: border-box;">
      <h1 style="color: #E50914; font-size: 24px; margin-bottom: 20px;">Verifying your Email</h1>
      <p style="font-size: 16px; margin-bottom: 20px; color: #ffffff; line-height: 1.5;">Hello,</p>
      <p style="font-size: 16px; margin-bottom: 20px; color: #ffffff; line-height: 1.5;">Thank you for signing up. Please use the verification code below to confirm your email address and complete your account setup:</p>
      
      <div style="background-color: #333333; padding: 20px; border-radius: 8px; display: inline-block;">
        <span style="font-size: 24px; font-weight: bold; color: #E50914;">${code}</span>
      </div>
      
      <p style="font-size: 16px; margin-top: 20px; color: #ffffff; line-height: 1.5;">This code will expire in 10 minutes.</p>
      <p style="font-size: 16px; color: #ffffff; line-height: 1.5;">If you did not request this verification, please ignore this email or contact support.</p>
    </div>
    
    <!-- Footer -->
    <div style="margin-top: 20px; font-size: 12px; color: #888; text-align: center;">
      <p>© ${year} Filmu. All rights reserved.</p>
    </div>
  </div>
`;

    // Send verification email with the styled content
    await transporter.sendMail({
      from: {
        name: 'Filmu',
        address: process.env.EMAIL_USER,
      },
      to: email,
      subject: 'Code de Vérification pour Votre Email',
      html: emailHTML,
    });

    return res.status(200).json({ message: 'Verification code sent' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to send verification code' });
  }
};





// Verify code and update password
const isSecurePassword = (password) => {
  // This regex allows special characters such as #, -, _, +, !, $, %, &, *, ? etc.
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=[\]{};:'",.<>?\\|`~])[A-Za-z\d!@#$%^&*()_\-+=[\]{};:'",.<>?\\|`~]{8,}$/;
  return passwordRegex.test(password);
};



// API Endpoint to verify email, process transaction ID, phone number, and upload an image
export const verifyEmailCode = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email,newPassword, code, phone,countryCode } = req.body;
  const phoneNumber=`${countryCode} ${phone}`

  if (!email) {
   
    return res.status(404).json({ message: 'no email found' });
    
  }
  if (!code) {
   
    return res.status(404).json({ message: 'no code found' });
  }
  if (!newPassword||!isSecurePassword(newPassword)) {
   
    return res.status(404).json({ message: 'password no secure' });
  }
 
  if (phone && phone?.length<8) {
    return res.status(400).json({ message: 'Phone number be in correct format'+phone });
  }
  try {
    const UserToCreate = await prismaclient.verifyUser.findUnique({ where: { email } });
    if (!UserToCreate) {
      return res.status(404).json({ message: 'We did find you' });
    }
 //   console.log(UserToCreate.verificationCode,code)
    if (UserToCreate.verificationCode !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    if (moment().isAfter(UserToCreate.codeExpiresAt)) {
      return res.status(400).json({ message: 'Verification code has expired' });
    }
   
    // Update the client's status to approved, clear verification code, and store other details
    const updateData = {
      isApproved: true,
      verificationCode: null,
      codeExpiresAt: null,
      phonenumeber:phone,       // Store phone number
    };

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prismaclient.verifyUser.update({
      where: { email },
      data: updateData,
    });
   const newuser= await prismaclient.user.create({
      data:{
        email,
        phone:phoneNumber,
        password: hashedPassword,
        devices: 1
      }
    })
    await prismaclient.user.update({
      where: { email },
      data: {refferalCode:newuser.id},
    });

    return res.status(200).json({ message: 'Email verified successfully' });
  } catch (err) {
    console.error(err);
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(500).json({ message: 'Failed to verify email' });
  }
};











export const requestPasswordReset = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email } = req.body;

  try {
    const user = await prismaclient.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate a random verification code
    const code = crypto.randomBytes(3).toString('hex');
    const expiresAt = moment().add(10, 'minutes').toISOString();

    // Save code and expiration in the database
    await prismaclient.user.update({
      where: { email },
      data: { resetCode: code, codeExpiresAt: expiresAt },
    });
    const year = new Date().getFullYear();
    
    // Netflix-style HTML email content
    const emailHTML = `
  <div style="background-color: #141414; padding: 20px; color: white; font-family: Arial, sans-serif; text-align: center; width: 100%; box-sizing: border-box;">
    <!-- Logo -->
    <div style="margin-bottom: 20px;">
      <img src="https://i.postimg.cc/cJmbLVSV/filmulogo-1.png" alt="Votre Logo" style="width: 120px; height: auto; border-radius: 8px;" />
    </div>
    
    <!-- Contenu principal -->
    <div style="background-color: #222222; padding: 20px; border-radius: 8px; display: inline-block; text-align: left; width: 100%; max-width: 600px; margin: 0 auto; box-sizing: border-box;">
      <h1 style="color: #E50914; text-align: center; font-size: 24px;">Demande de Réinitialisation de Mot de Passe</h1>
      <p style="font-size: 16px; margin-bottom: 16px; color: #ffffff;">Bonjour,</p>
      <p style="font-size: 16px; margin-bottom: 16px; color: #ffffff;">Nous avons reçu une demande de réinitialisation de votre mot de passe. Veuillez utiliser le code de vérification ci-dessous pour continuer :</p>
      
      <div style="text-align: center; margin: 20px 0;">
        <span style="font-size: 24px; font-weight: bold; color: #E50914;">${code}</span>
      </div>
      
      <p style="font-size: 16px; margin-bottom: 16px; color: #ffffff;">Ce code expirera dans 10 minutes.</p>
      <p style="font-size: 16px; color: #ffffff;">Si vous n'avez pas demandé de réinitialisation de mot de passe, veuillez ignorer cet e-mail ou contacter le support.</p>
    </div>
    
    <!-- Pied de page -->
    <div style="margin-top: 20px; font-size: 12px; color: #888; text-align: center;">
      <p>© ${year} Filmu.. Tous droits réservés.</p>
    </div>
  </div>
  
  <!-- Media query for responsiveness -->
  <style>
    @media only screen and (max-width: 600px) {
      div {
        padding: 10px !important;
      }
      
      h1 {
        font-size: 20px !important;
      }
      
      p {
        font-size: 14px !important;
      }
      
      img {
        width: 100px !important;
      }
    }
  </style>
`;


// Send verification email with the styled content
await transporter.sendMail({
  from: {
    name: 'Filmu',
    address: process.env.EMAIL_USER,
  },
  to: email,
  subject: 'Code de Vérification pour Réinitialisation de Mot de Passe',
  html: emailHTML,
});


    return res.status(200).json({ message: 'Verification code sent' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to send verification code' });
  }
};

// Verify code and update password

export const updatePassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, newPassword, code } = req.body;
  
  try {
    const user = await prismaclient.user.findUnique({ where: { email } });

    // Check if user exists and has requested a reset
    if (!user || !user.resetCode || !user.codeExpiresAt) {
      return res.status(400).json({ message: 'Invalid request or expired code' });
    }
    //console.log(user.resetCode,code)
    // Validate the code
    if (user.resetCode !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // Check if the code has expired
    if (moment().isAfter(moment(user.codeExpiresAt))) {
      return res.status(400).json({ message: 'Code has expired' });
    }

    // Ensure the new password is secure
    if (!isSecurePassword(newPassword)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long and include uppercase letters, lowercase letters, numbers, and special characters.',
      });
    }

    // Check if the new password is different from the old one
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ message: 'New password cannot be the same as the previous password.' });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password and clear the reset code and expiration
    await prismaclient.user.update({
      where: { email },
      data: { password: hashedPassword, resetCode: null, codeExpiresAt: null },
    });

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password update error:', err);
    return res.status(500).json({ message: 'Failed to update password' });
  }
};

// Middleware for validation
export const validateUpdateProfile = [
  body('email').optional().isEmail().withMessage('Invalid email format'),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
  body('password')
    .optional()
    .matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/)
    .withMessage(
      'Password must be at least 8 characters long and contain at least one letter and one number'
    ),
  body('idpicture')
    .optional()
    .notEmpty()
    .withMessage('ID picture cannot be empty')
]

// Update user profile
export const updateProfileField = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { fieldName, fieldValue, targetUserId, targetEmail, code } = req.body;
  const userId = req.user.id;
  const isAdmin = req.isAdmin;
  const isAgent = req.isAgent;
  const isUser = req.isUser;

  try {
    // Determine the user to update
    let userToUpdate;
    if (isAdmin) {
      if (targetUserId) {
        userToUpdate = await prismaclient.user.findUnique({
          where: { id: targetUserId },
        });
      } else if (targetEmail) {
        userToUpdate = await prismaclient.user.findUnique({
          where: { email: targetEmail },
        });
      }
    } else {
      userToUpdate = await prismaclient.user.findUnique({
        where: { id: userId },
      });
    }

    if (!userToUpdate) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateUserId = isAdmin ? userToUpdate.id : userId;

    // Role-based field update permissions
    const userAllowedFields = ['phone', 'name','SocialMedias'];

    
    if (isUser && !userAllowedFields.includes(fieldName)) {
      return res.status(403).json({ message: 'Access denied field name wrong' });
    }

    if (isAdmin && (fieldName === 'role' || fieldName === 'isFinance') && code !== 'idrissaAsAdmin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    // Hash the new password if the fieldName is 'password'
    let valueToUpdate = fieldValue;
    if (fieldName === 'password') {
      valueToUpdate = await bcrypt.hash(fieldValue, 10);
    }
    // Perform the update using the utility function
    const updatedUser = await updateAField(
      'user',
      { id: updateUserId },
      fieldName,
      valueToUpdate
    );
    const respondUpdatedUser = await prismaclient.user.findUnique({
      where: { id: updatedUser.id },
      select: {
        email: true,
        [fieldName]: true, // Selects only the updated field dynamically
      },
    });
    res.status(200).json({
      message: 'Profile field updated successfully',
      user: respondUpdatedUser,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update profile field' });
  }
};

// Get user profile
export const getProfile = async (req, res) => {
  try {
    //console.log("user ask info")

    let userId = req.user.id;
    const { targetUserId } = req.query;
    if (req.isAdmin&&targetUserId){userId=targetUserId}


    // Assuming user role is stored in req.user

    // Define baseSelect as the default selection
    const baseSelect = {
      id: true,
      name: true,
      email: true,
      phone: true,
      profilePicture: true,
      balance: true,
      isactive: true,
      subscribtionEndDay: true,
      subscribtionStartDay: true,
      subscription:true,
      isbanned: true,
      SocialMedias:true,
      creationdate: true,
      StreamingAccess:true,
      refferalCode:true,
      devicesInfo:true,
      isFinance:true,
      role:true,
      devices: true,
      taste: {
        select: {
          name: true,
          creationdate: true,
          lastupdate: true,
        },
      },
      watching:true,
      transactions: {
        select: {
          id:true,
          ID: true,
          amount: true,
          details: true,
          phonenumber: true,
          isApproved: true,
          reversed:true,
          isPending: true,
          isRetrait: true,
          isCanceled: true,
          transactionType: true,
          lastModified: true,
        },
      },
      downloads: {
        select: {
          fulfilledDate: true,
          expirationDate: true,
          isExpired: true,
          SerieId: true,
          movieId: true,
        },
      },
    };

    // Merge custom selection only if user is admin and provided a selection in req.body
   
    
   
    const user = await prismaclient.user.findUnique({
      where:{ id: userId } ,
      select: baseSelect,
    });

    if (!user) {
      return res.status(504).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

export const getUserAll = async (req, res) => {
  const isAdmin = req.isAdmin;
  try {
    if (!isAdmin) {
      return res.status(403).json({ message: 'Access denied' }); // Forbidden
    }

    // Define the base select fields
    const baseSelect = {
      id:true,
      email:true,
      name:true
    };

    // Add any extra selections provided by admin in `req.body.selection`
    const adminSelections = req.body.selection || {};
    const userSelect = { ...baseSelect, ...adminSelections };

    const users = await prismaclient.user.findMany({
      select: userSelect,
    });

    res.status(200).json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to get users' });
  }
};

export const getAgenAll = async (req, res) => {
  
  try {
   

    const users = await prismaclient.user.findMany({
      
      where: { role: "AGENT" }
      ,select: {

        SocialMedias:true,//whatapp,telegram.....
        email: true,
        phone: true,
        workingtime:true,
        
      }
    })

    res.status(200).json(users)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to get users' })
  }
}

export const deleteUser = async (req, res) => {
  try {
    const { targetUserId, targetEmail, targetName } = req.body
    let findUser
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Access denied' }) // Forbidden
    }

    if (targetUserId) {
      findUser = await prismaclient.user.findUnique({
        where: { id: targetUserId }
      })
    } else if (targetEmail) {
      findUser = await prismaclient.user.findUnique({
        where: { email: targetEmail }
      })
    } else if (targetName) {
      findUser = await prismaclient.user.findUnique({
        where: { name: targetName }
      })
    }

    if (!findUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    await prismaclient.user.delete({ where: { id: findUser.id } })
    res.status(200).json({ message: 'User deleted' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to delete user' })
  }
}
export const updateStreamingAccess = async (req, res) => {
  const { users, all, streamAccessUpdates } = req.body;
  const isAdmin = req.isAdmin;

  if (!isAdmin) {
    return res.status(403).json({ message: 'Access denied' }); // Forbidden
  }

  try {
    let usersToUpdate = [];

    // If all:true is provided, fetch all users
    if (all) {
      usersToUpdate = await prismaclient.user.findMany({
        select: { id: true, StreamingAccess: true }
      });
    } else if (users) if (Array.isArray(users) && users.length > 0) {
      // Fetch the users specified in the request body
      usersToUpdate = await prismaclient.user.findMany({
        where: { id: { in: users } },
        select: { id: true, StreamingAccess: true }
      });
    }

    if (usersToUpdate.length === 0) {
      return res.status(404).json({ message: 'No users found to update' });
    }

    // Update the StreamingAccess for each user
    const updatedUsers = await Promise.all(
      usersToUpdate.map(async (user) => {
        if (!user.isactive||user.isbanned) {
          return await prismaclient.user.update({
            where: { id: user.id },
            data: { StreamingAccess: null }
          });
        }
        const currentStreamingAccess = user.StreamingAccess || {};

        // Merge the new updates with the existing StreamingAccess field
        const updatedStreamingAccess = {
          ...currentStreamingAccess,  // Keep existing keys intact
          ...streamAccessUpdates      // Apply the new updates
        };

        // Update the user with the merged StreamingAccess field
        return await prismaclient.user.update({
          where: { id: user.id },
          data: { StreamingAccess: updatedStreamingAccess }
        });
      })
    );

    res.status(200).json({
      message: 'Streaming access updated successfully',
      users: updatedUsers
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update streaming access' });
  }
};
export const getActiveUsers = async (req, res) => {
  try {
   const {active}= req.body
    // Check if the user is an admin
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Fetch all active users
    const activeUsers = await prismaclient.user.findMany({
      where: {
        isactive: active
      }
    });

    res.status(200).json(activeUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch active users' });
  }
};
export const getBannedUsers = async (req, res) => {
  try {
    const {ban}= req.body
    // Check if the user is an admin
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Fetch all banned users
    const bannedUsers = await prismaclient.user.findMany({
      where: {
        isbanned: ban
      }
    });

    res.status(200).json(bannedUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch banned users' });
  }
};

export const banUser = async (req, res) => {
  try {
    const { targetUserId, targetEmail, targetName, ban } = req.body
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Access denied' }) // Forbidden
    }

    let findUser

    if (targetUserId) {
      findUser = await prismaclient.user.findUnique({
        where: { id: targetUserId }
      })
    } else if (targetEmail) {
      findUser = await prismaclient.user.findUnique({
        where: { email: targetEmail }
      })
    } else if (targetName) {
      findUser = await prismaclient.user.findUnique({
        where: { name: targetName }
      })
    }

    if (!findUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    const updatedUser = await prismaclient.user.update({
      where: { id: findUser.id },
      data: { isbanned: ban }
    })

    res
      .status(200)
      .json({ message: 'User banned successfully', user: updatedUser })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to ban user' })
  }
}
export const OffUser = async (req, res) => {
  try {
    const { targetUserId, targetEmail, targetName, active } = req.body
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Access denied' }) // Forbidden
    }

    let findUser

    if (targetUserId) {
      findUser = await prismaclient.user.findUnique({
        where: { id: targetUserId }
      })
    } else if (targetEmail) {
      findUser = await prismaclient.user.findUnique({
        where: { email: targetEmail }
      })
    } else if (targetName) {
      findUser = await prismaclient.user.findUnique({
        where: { name: targetName }
      })
    }

    if (!findUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    const updatedUser = await prismaclient.user.update({
      where: { id: findUser.id },
      data: { isactive: active }
    })

    res
      .status(200)
      .json({ message: 'User banned successfully', user: updatedUser })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to ban user' })
  }
}

// Flag a device as suspicious
export const flagDevice = async (req, res)=> {
  const { deviceId } = req.body;
  const userId = req.userId;

  try {
    // Update the device record, setting isFlagged to true
    const updatedDevice = await prismaclient.device.updateMany({
      where: {
        id: deviceId,
        userId: userId, // Ensure the device belongs to the requesting user
        isActive: true
      },
      data: {
        isFlagged: true
      }
    });

    if (updatedDevice.count === 0) {
      return res.status(404).json({ message: 'Device not found or already inactive' });
    }

    res.status(200).json({ message: 'Device flagged successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error flagging device', error });
  }
}
