import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import prismaclient from '../lib/prisma.js'; // Ensure to add the .js extension if needed



dotenv.config();

const authenticateToken = async (req, res, next) => {
 // let token = req.cookies.accessToken; // Retrieve token from cookies
 // console.log("token",token);
   const token= req.headers['authorization']?.split(' ')[1]
; 
  if (!token) {
  
    return res.status(400).json({ message: 'No token found' });
  }
  

  try {
    const secretKey = process.env.JWT_SECRET_KEY;
    const tosee= await prismaclient.device.findUnique({
      where: {
        token: token,
      }
    });
    if (!tosee){
     // res.clearCookie('accessToken');
    //  console.log("token",token);
      return res.status(400).json({exit:true, message: 'Vous avez été exclu' });
    }
    const todelete= await prismaclient.device.findUnique({
      where: {
        token: token,
        isFlagged:true
      }
    });
    if(todelete)
     {
     await prismaclient.device.delete({
      where: {
        token: token,
        isFlagged:true
      }
    });
    console.log("token",token);
      // Device deleted, proceed with logout
      //res.clearCookie('accessToken');
      return res.status(400).json({ exit:true,message: 'Vous avez été exclu' });
    }
   
   
    const { id } = jwt.verify(token, secretKey).user;
     let user;
     if (id)  user = await prismaclient.user.findUnique({ where: { id },
      
      select: {
        role: true,
        id: true,
        SocialMedias: true ,
        isactive: true,
        isFinance: true,
        isbanned: true,
        imgcount:true
      } }); // Correctly use findUnique
     //console.log(jwt.verify(token, secretKey));

    if (!user) {
     console.log("User not found");
      return res.sendStatus(404).json({ message: 'User not found' });; // Not Found
    }
    
    if (user.isbanned) {
      return res.status(403).json({ message: 'User is banned' }); // Banned user response
    }

    // Destructure user properties for easier access
    const {
      role,
      StreamingAccess,
      isactive,
      isFinance,
      id: userId,
    } = user;

    // Assign user info to the request object
    req.user = user;
    req.isAdmin = role === 'ADMIN';
    req.isAgent = role === 'AGENT';
    req.isUser = role === 'USER';
    req.StreamingAccess = StreamingAccess;
    req.isActive = isactive === true; // Ensure a boolean
    req.key = StreamingAccess?.key; // Optional chaining for key
    req.isFinance = isFinance;
    req.userId = userId;
    req.imgcount=user?.imgcount 
    req.token=token

    next(); // Proceed to the next middleware
  } catch (err) {
    console.error(err);
    return res.sendStatus(403); // Forbidden
  }
};

export default authenticateToken;
