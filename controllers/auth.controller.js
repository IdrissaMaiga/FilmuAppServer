import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prismaclient from '../lib/prisma.js'
import dotenv from 'dotenv'


dotenv.config();

export const login = async (req, res) => {
  const { email, password,deviceInfo } = req.body;
 // console.log("user in")
  try {
    const user = await prismaclient.user.findUnique({
      where: { email },
      select: {
        phone: true,
        id: true,
        name: true,
        email: true,
        SocialMedias: true ,
        profilePicture: true,
        balance: true,
        role: true,
        isactive: true,
        isFinance: true,
        subscribtionEndDay: true,
        subscribtionStartDay: true,
        isbanned: true,
        creationdate: true,
        downloads: true,
        watching: true,
        devicesInfo:true,
        transactions: true,
        subscription: true,
        devices: true,
        subscription: true,
        password:true,
        StreamingAccess:true
      }
       // Include necessary relations upfront
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials!' });
    }
    
    // Check for banned users
    if (user.isbanned) {
      return res.status(403).json({ message: 'User is banned' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials!' });
    }

   
    // Store device information
   

    const userInfo = await handleUserBonus(user);
    
    const payload={id :userInfo.id,
       
      }
    const token = generateToken(payload);
    await registerDevice(user, deviceInfo, token)
   // res.cookie('accessToken', token, {
      // httpOnly: true,
     //   maxAge: 1000 * 60 * 60 * 24 * 7 ,
     // SameSite:"None",
     // secure: true
    // });
    userInfo.accessToken=token;
    res.status(200).json(userInfo);
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to login!' });
  }
};


async function registerDevice(userInfo, deviceInfo, token) {
  // Prepare device data
  const deviceData = {
    userId: userInfo.id,
    deviceType: deviceInfo?.deviceType,
    browser: deviceInfo?.browser,
    os: deviceInfo?.os,
    location: deviceInfo?.location,
    ipAddress: deviceInfo?.ipAddress,
    loginTime: new Date(),
    isActive: true,
    token: token,
  };

  try {
    // Fetch all active devices for the user
    const activeDevices = await prismaclient.device.findMany({
      where: {
        userId: userInfo.id,
      },
      orderBy: {
        loginTime: 'asc', // Oldest login time first
      },
    }) || [];
    /// console.log(userInfo.devices,activeDevices.length,userInfo.devices)
    // Check if the user has a device limit and remove excess devices
    if (activeDevices.length >= userInfo.devices) {
      const excessDeviceCount = activeDevices.length - userInfo.devices + 1;
      // Delete the oldest devices in a single operation
      const deviceIdsToDelete = activeDevices.slice(0, excessDeviceCount).map((device) => device.id);
      await prismaclient.device.deleteMany({
        where: {
          id: {
            in: deviceIdsToDelete,
          },
        },
      });
    }

    // Add the new device
    const device = await prismaclient.device.create({
      data: deviceData,
    });

    return {
      message: 'Device registered successfully',
      device: device,
    };
  } catch (error) {
    console.error('Error registering device:', error);
    throw new Error('Failed to register device');
  }
}


// Handle user bonus calculation
const handleUserBonus = async (user) => {
  const admin = await prismaclient.user.findFirst({ where: { role: 'ADMIN' } });
  let totalBonus = 0;
  const currentDate = new Date();

  if (admin) {
    const completedReferrals = await prismaclient.userReferral.findMany({
      where: {
        referrerId: user.id,
        endDay: { lte: currentDate },
        isEmpted: false,
      },
      include: { subscription: true, referred: { include: { subscription: true } } },
    });

    for (const referral of completedReferrals) {
      const referredSubscription = referral.referred.subscription;
      if (referral.subscription && referredSubscription && referredSubscription.type === referral.subscription.type) {
        const daysDifference = (new Date(referral.endDay).getTime() - new Date(referral.startDay).getTime()) / (1000 * 60 * 60 * 24);
        const referralBonus = 0.2 * (referredSubscription.price * (daysDifference / referredSubscription.duration));

        await Promise.all([
          prismaclient.user.update({ where: { id: admin.id }, data: { balance: { decrement: referralBonus } } }),
          prismaclient.user.update({ where: { id: user.id }, data: { balance: { increment: referralBonus } } }),
          prismaclient.userReferral.update({ where: { id: referral.id }, data: { isEmpted: true } }),
        ]);

        totalBonus += referralBonus;
      }
    }
  }

  return await prismaclient.user.findUnique({
    where: { id: user.id },
    select: {
      role: true,
      id: true,
      name: true,
      email: true,
      phone: true,
      SocialMedias: true ,
      profilePicture: true,
      balance: true,
      isactive: true,
      isFinance: true,
      subscribtionEndDay: true,
      subscribtionStartDay: true,
      isbanned: true,
      creationdate: true,
      downloads: true,
      watching: true,
      transactions: true,
      subscription: true,
      devicesInfo:true,
      devices: true,
      subscription: true,
      password:true,
      StreamingAccess:true
    }
  }).then(userInfo => {
    if (totalBonus > 0) userInfo.bonus = totalBonus;
    return userInfo;
  });
};


// Generate JWT token
const generateToken = (userInfo) => {
  const age = 1000 * 60 * 60 * 24 * 7; // 1 week
  const secretKey = process.env.JWT_SECRET_KEY;
  
  return jwt.sign(
    { user: userInfo },
    secretKey,
    { expiresIn: age }
  );

};



// Logout Route
export const logout = async (req, res) => {
  const token = req.cookies.accessToken; // Retrieve token from cookies
  prismaclient.device.delete({
    where: {
      token: token,
    }
  });
  prismaclient.device.delete({
    where: {
      isFlagged: true,
    }
  });
  res.clearCookie('accessToken');
  res.status(200).json({ message: 'Logout successful' });
};
  // Optionally add the token to a blacklist
  // blacklistedTokens.add(req.cookies.token); // Use a set or database collection

