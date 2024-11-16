// controllers/transaction.controller.js
import prismaclient from "../lib/prisma.js";
import { DateTime } from "luxon";
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import Tesseract from 'tesseract.js';






export const createsubscriptionTransaction = async (req, res) => {
  const { unit, type, refferedCode } = req.body;
  const userId = req.user.id;

  try {
    const user = await prismaclient.user.findUnique({
      where: { id: userId },
      include: { subscription: true }
    });

    if (!type) return res.status(404).json({ error: "Define your type" });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!unit || unit < 0) return res.status(400).json({ error: "Unit is not well set" });

    let currentSubscription = user.subscription;
    const currentDate = DateTime.now();
    let discount = 1; // Default no discount
    //console.log(currentSubscription)
    // Check if referred code matches any existing user's referral code
    if (refferedCode) {
      const referringUser = await prismaclient.user.findUnique({
        where: { refferalCode: refferedCode }
      });

      if (referringUser) {
        discount = 0.85; // 15% discount
      }
    }
    const subscriptionEndDay = (user.subscribtionEndDay <=currentDate)
    ? currentDate
    : DateTime.fromJSDate(user.subscribtionEndDay);

   

    // Handle existing subscription
    if ((currentSubscription && currentSubscription.type === type)||subscriptionEndDay==currentDate) 
      { const sub= await prismaclient.subscription.findUnique({
        where:{type}
      })
      if (!currentSubscription) currentSubscription=sub
      //console.log(currentSubscription)
        const newEndDate = subscriptionEndDay.plus({ days: currentSubscription.duration * unit });
        const transactionAmount = currentSubscription.price * unit * discount;
      // Check if user balance can afford the transaction
      if (user.balance < transactionAmount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      const admin = await prismaclient.user.findFirst({
        where: { role: "ADMIN" },
      });
      
      if (!admin) return res.status(400).json({ error: "Impossible transaction" });

      await prismaclient.user.update({
        where: { id: admin.id },
        data: {
          balance: { increment: transactionAmount },
        },
      });

      // Extend the current subscription
      await prismaclient.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: transactionAmount },
          subscribtionStartDay:subscriptionEndDay,
          subscribtionEndDay: newEndDate.toJSDate(),
          subscriptionId :currentSubscription.id,
          isactive: true,
        }
      });

      // Create the transaction for the extension
      const transaction = await prismaclient.transaction.create({
        data: {
          userId,
          amount: -transactionAmount,
          isApproved: true,
          isPending: false,
          isRetrait: false,
          transactionType: "ABON",
          unit,
          subscriptionId: currentSubscription.id,
          phonenumber: user.phone
        }
      });

      // Create referral relation if applicable
      if (refferedCode && referringUser) {
        await prismaclient.userReferral.create({
          data: {
            referrerId: referringUser.id,
            referredId: userId,
            type: currentSubscription.type,
            startDay: currentDate.toJSDate(),
            endDay: newEndDate.toJSDate()
          }
        });
      }
   
      return res.status(200).json({ message: "Subscription extended successfully", transaction });
    } 
    else return res.status(400).json({ error: "not the same type wait for end " });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};





  export const createdownloadsTransactionSingle = async (req, res) => {
    const { SerieId, movieId, allow } = req.body;  // Either SerieIdor movieId will be provided in the request
    const userId = req.user.id;
  
    try {
      // Find user and check subscription
      const user = await prismaclient.user.findUnique({
        where: { id: userId },
        include: { subscription: true }
      });
  
      if (!user) return res.status(404).json({ error: "User not found" });
  
      const subscription = user.subscription;
  
      // Check if user has an active subscription
      if (!subscription || !user.isactive) {
        return res.status(403).json({ error: "Active subscription required to download content" });
      }
  
      // Check if there's an existing active download for the specified episode or movie
      const activeDownload = await prismaclient.downloads.findFirst({
        where: {
          userId,
          isExpired: false,
          OR: [
            { SerieId :SerieId|| undefined },
            { movieId: movieId || undefined }
          ]
        }
      });
       let element;
     
         if (SerieId ) element= await prismaclient.series.findUnique({
          where: { id: SerieId }
        });
        if (movieId ) element=  await prismaclient.movie.findUnique({
          where: { id: movieId }
        });
        
        
       
      
      if (activeDownload) {
        return res.status(400).json({ error: "Active download already exists for this content" });
      }
      if (!element) {
        return res.status(400).json({ error: "Movie or Serie does not exist" });
      }
      
      // Verify download limits based on the subscription
      const downloadsCount = await prismaclient.downloads.count({
        where: { userId, isExpired: false }
      });
      console.log(downloadsCount,user.subscription.downloads)
      let transactionAmount = 0;
      if (downloadsCount >= user.subscription.downloads) {
        if (!allow) {
          return res.status(200).json({ done: false });
        }
        transactionAmount = element.downloadPrice||200;
      }
  
      if (user.balance < Math.abs( transactionAmount)) {  
        return res.status(400).json({ error: "Insufficient balance" });
      
      }
  
      const fulfilledDate = DateTime.now().toJSDate();
      const expirationDate = DateTime.now().plus({ days: 7 }).toJSDate();
      const admin= await prismaclient.user.findFirst({
        where: { role:"ADMIN"},
       
      })
  
      ;if (!admin)return res.status(400).json({ error: "imposible transaction" });
        await prismaclient.user.update({
          where: { id: admin.id },
          data: {
            balance: { increment: Math.abs( transactionAmount) },
          },
        });
      // Deduct balance
      const updatedUser =await prismaclient.user.update({
        where: { id: userId },
        data: { balance: { decrement:Math.abs( transactionAmount) },
        downloadnumber:{decrement:downloadsCount}
       }
      });
  
      // Create a transaction
      const transaction = await prismaclient.transaction.create({
        data: {
          userId,
          amount: -transactionAmount,
          isApproved: true,
          isPending: false,
          transactionType: "TELE",
          phonenumber: user.phone,
          unit: 1
        }
      });
      
      // Register the download
      const download = await prismaclient.downloads.create({
        data: {
          userId,
          transactionId: transaction.id,
          fulfilledDate,
          expirationDate,
          isExpired: false,
          SerieId:SerieId || null,
          movieId: movieId || null
        }
      });
  
      return res.status(201).json({
        message: "Download successful",
        transaction,
        download,
        user:updatedUser,
        done:true
      });
  
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
  



  
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  // Set up the directory where images will be stored
  const directory = path.join(__dirname, '../deposit');
  
  
  // Ensure the directory exists, create it if not
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory);
  }
  


  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, directory); // Update this with the correct path
    },
    filename: (req, file, cb) => {
      const userId = req.userId;
      const imgcount=req.imgcount
        cb(null, `${userId}${imgcount}.png`);
    },
});

// multer setup
const upload = multer({ storage });

// Function for uploading a single image
export const uploadSingleImage = (req, res, next) => {
    upload.single('picture')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: 'File upload error' });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};
 
  // Controller to handle deposit transactions
  export const createDepositTransaction = async (req, res) => {
    let imagePath = null;
    const userId = req.user.id;
    const imgcount=req.imgcount
    try {
    
    if (req.file) {
      imagePath = path.join(directory, `${userId}${imgcount}.png`);
       
          const details=[]
          if (imagePath){details.push(imagePath)
            await prismaclient.user.update({
              where: { id: userId},
              data: { imgcount: { increment:1  } },
            });
          }


           

            Tesseract.recognize(imagePath, 'fra')
              .then(async({ data: { text } }) => {
                const cleanedText = text.replace(/\s+/g, ' ').trim();
                // Regular expression to match "transfer sent" transactions
                const transferSentRegex = /Votre transfert de (\d+) FCFA vers le (\d+) a reussi\. Frais: (\d+) FCFA\. Nouveau solde:(\d+) FCFA\. ID:([\w.]+)\. ([\w.]+) MALI/g;
                
                // Regular expression to match "transfer received" transactions
                const transferReceivedRegex = /Vous avez recu un transfert de (\d+) FCFA du (\d+)\. ID:\s*([\w.]+)\./g;
               let Meamlast;
                // Extracting "transfer sent" transactions
                for (const match of cleanedText.matchAll(transferSentRegex)) {
                  const [_, amount, phoneNumber, fee, newBalance, id,Mean] = match;
                // Save "Transfer Sent" transaction to the database
                  await prismaclient.transferData.create({
                    data: {
                      type: "TransferSent",
                      amount: parseInt(amount),
                      phone: phoneNumber || null,
                      Id: id.toUpperCase(),
                      fee: parseInt(fee),
                      balance: parseInt(newBalance),
                      mean:Mean
                    }
                  });
                  Meamlast=Mean
                }
                // Extracting "transfer received" transactions
                for (const match of cleanedText.matchAll(transferReceivedRegex)) {
                  const [_, amount, senderPhone, id] = match;
                  // Save "Transfer Received" transaction to the database
                  await prismaclient.transferData.create({
                    data: {
                      type: "TransferReceived",
                      amount: parseInt(amount),
                      phone: senderPhone || null,
                      Id: id.toUpperCase(),
                      balance: 0 // Assuming balance is not part of received data
                    }
                  });
                }

                // Step 2: Regular expression to find all amounts from "Votre transfert de" pattern
                const amountRegex = /transfert de (\d+) /g;
                const amounts = [...cleanedText.matchAll(amountRegex)].map(match => match[1]);

                // Step 3: Regular expression to find all IDs in "ID:" patterns
                const idRegex = /ID:([\w.]+)\./g; 
                const ids = [...cleanedText.matchAll(idRegex)].map(match => match[1]);

                //console.log("Amounts:", amounts); // Array of amounts
               // console.log("IDs:", ids);   
                          


        
          const amount=parseFloat((amounts?.length > 0 ? amounts.at(-1) :undefined))
          const ID=(ids.length > 0 ? ids.at(-1).toUpperCase() :undefined)
          if (!ID){fs.unlink(imagePath, (unlinkErr) => {
            if (unlinkErr) console.error('Failed to delete image:', unlinkErr);
          });
            return res.status(400).json({ error: 'wrong image' });}

          const tdata= await prismaclient.transferData.findFirst({
            where: { Id: ID.toUpperCase(),type: 'TransferSent' },
          })
          const matchingMoneyflow = await prismaclient.moneyflow.findFirst({
            where: { ID: ID.toUpperCase(), type: 'RECEIVED' },
          });

           const existingApprovedTransaction = await prismaclient.transaction.findFirst({
              where: { ID: ID.toUpperCase(), isApproved: true, transactionType: 'DEPO' },
            });
            if (existingApprovedTransaction) {
              if (imagePath) {
                fs.unlink(imagePath, (unlinkErr) => {
                  if (unlinkErr) console.error('Failed to delete image:', unlinkErr);
                });
              }
              return res.status(400).json({ error: 'Approved transaction with this ID exists' });
            }
        
            
             
            const transaction = await prismaclient.transaction.create({
              data: {
                userId,
                amount:amount,
                ID: ID ,
                isApproved: !!matchingMoneyflow,
                isPending: !matchingMoneyflow,
                transactionType: 'DEPO',
                phonenumber: tdata.phone || req.user.phone,
                details: details,
                unit: 1,
                mean:Meamlast=="OFM"?"OrangeMoney":undefined
              },
            });
        
            if (matchingMoneyflow) {

              await prismaclient.user.update({
                where: { id: userId},
                data: { balance: { increment: Math.abs(matchingMoneyflow.amount) } },
              });
              await prismaclient.transaction.updateMany({
                where: {
                  ID: ID.toUpperCase(),
                  isApproved: false,
                  isPending: true,
                  isCanceled: false,
                  reversed: false,
                  id: { not: transaction.id },  // Exclude the confirmed transaction
                },
                data: { isCanceled: true,isPending: false },
              });
               await prismaclient.transaction.update({
                where:{id:transaction.id},
                data: {
                  amount:matchingMoneyflow.amount,
                },
              });
          
            }
        
            
        
            return res.status(201).json({
              message: matchingMoneyflow ? 'Deposit successful' : 'Deposit pending approval',
              transaction,
            });
          }) }
          else return res.status(400).json({ error: 'wrong image' });
          
    } catch (error) {
      console.error(error);
  
      // Delete image if there was an error during transaction
      if (imagePath) {
        fs.unlink(imagePath, (unlinkErr) => {
          if (unlinkErr) console.error('Failed to delete image:', unlinkErr);
        });
      }
  
      return res.status(500).json({ error: 'Internal server error' });
    }
  };




  
  export const createRetraitTransaction = async (req, res) => {
    const { amount} = req.body;
    const userId = req.user.id;
  
    if (amount < 800) return res.status(400).json({ error: "Retrait amount must greater than 1000 CFA" });
   
  
    try {
      const user = await prismaclient.user.findUnique({
        where: { id: userId }
      });
  
      if (!user) return res.status(404).json({ error: "User not found" });
      if (user.balance < Math.abs(amount)) {
        return res.status(400).json({ error: "Insufficient balance for retrait" });
      }
  
      // Check if there is already an approved transaction with this ID
      const transaction = await prismaclient.transaction.create({
        data: {
          userId,
          amount:-amount,
          isApproved: false,
          isPending: true,
          transactionType: "RETRAIT",
          phonenumber: user.phone,
          isRetrait: true,
          unit: 1
        }
      });
      
      return res.status(201).json({
        message:"Retrait pending approval",
        transaction
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
  


  // Import necessary modules and Prisma client

// Helper function to reverse the transaction effects based on type
const reverseTransactionEffects = async (transaction, user) => {
  const { transactionType, amount, subscription } = transaction;
  const admin= await prismaclient.user.findFirst({
    where: { role:"ADMIN"},
   
  })
  if (!admin)throw new Error("impossible transaction")
  switch (transactionType) {
    case "ABON":  // Subscription transaction reversal
      const subscriptionDaysToRevert = transaction.unit * subscription.duration;
      const reversedEndDate = DateTime.fromJSDate(user.subscribtionEndDay).minus({ days: subscriptionDaysToRevert });
    
        await prismaclient.user.update({
          where: { id: admin.id },
          data: {
            balance: { decrement: Math.abs(amount) },
          },
        });
      await prismaclient.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: Math.abs(amount) },
          subscribtionEndDay: reversedEndDate.toJSDate(),
          isactive: reversedEndDate > DateTime.now().toJSDate(),
        }
      });

      // Remove the referral if it exists
      const referral = await prismaclient.userReferral.findFirst({
        where: {
          referredId: user.id,
          endDay: user.subscribtionEndDay, // Match the end date we just reversed
        }
      });

      if (referral) {
        await prismaclient.userReferral.delete({
          where: { id: referral.id }
        });
      }
     
      // Update the subscription end date and set isActive to false if reversal invalidates i
      break;

    case "TELE":  // Download transaction reversal
    
      await prismaclient.user.update({
        where: { id: admin.id },
        data: {
          balance: { decrement: Math.abs(amount) },
        },
      });
      const downloadCountToRevert = unit || 1;
      await prismaclient.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: Math.abs(amount) },
          downloadnumber: { increment: downloadCountToRevert }
        }
      });
      await prismaclient.downloads.updateMany({
        where: { transactionId: transaction.id },
        data: { isExpired: true,isCanceled :true }
      });
      break;
    default:
      throw new Error("Unsupported transaction type");
  }
};

// Reverse transaction function
export const reverseTransaction = async (req, res) => {
  const { targetUserId, transactionId } = req.body; // Destructure from req.body
  try {
    const transaction = await prismaclient.transaction.findUnique({
      where: { id: transactionId,userId:targetUserId },
      include: {
        subscription: true,   // Includes all fields in the related `Subscription` model
        download: true        // Includes all fields in the related `Downloads` model
      }
    })
    

    if (!transaction) return res.status(404).json({ error: "Transaction not found" });
    if (transaction.reversed) return res.status(400).json({ error: "Transaction already reversed" });
    if (!transaction.isApproved) return res.status(400).json({ error: "Transaction was not approved" });
    if (transaction.isApproved && (transaction.transactionType === "DEPO" || transaction.transactionType === "RETRAIT")) {
      return res.status(400).json({ error: "Approved DEPO and RETRAIT transactions cannot be reversed" });
    }
   
    const user = await prismaclient.user.findUnique({ where: { id: transaction.userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Reverse the effects of the transaction
    await reverseTransactionEffects(transaction, user);
     
    // Mark the transaction as reversed
    await prismaclient.transaction.update({
      where: { id: transactionId },
      data: { reversed: true }
    });

    res.status(200).json({ message: "Transaction reversed successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};


export const createMoneyflowoabsole = async (req, res) => {
  // Check if the user has the necessary finance permissions
  if (!req.isFinance) {
    return res.status(403).json({ error: "Unauthorized: Finance permissions required" });
  }

  // Destructure the necessary fields from the request body
  const { amount, phonenumeber,  ID, type , mean } = req.body;

  // Validate the required fields
  if (!amount  || !ID || !type) {
    return res.status(400).json({ error: "Missing required fields: amount, email, ID, and type are required" });
  }

  // Validate the transaction type
  if (!['RECEIVED', 'SENT'].includes(type)) {
    return res.status(400).json({ error: "Invalid type: Must be 'RECEIVED' or 'SENT'" });
  }

  try {
    // Create a new Moneyflow entry
    const moneyflow = await prisma.moneyflow.create({
      data: {
        amount,
        phonenumeber: phonenumeber || null,
        isApproved: true,  // Default approval status; adjust if necessary
        ID: ID.toUpperCase(),  // Normalize ID for consistency
        type,
        mean
      }
    });



    let pendingTransactions = await prismaclient.transaction.findFirst({
      where: {
        isApproved: false,
        isPending: true,
        isCanceled:false,
        reversed:false,
        amount:amount,
        ID: ID.toUpperCase(),
        type:"DEPO"
      }
    });
    if(!pendingTransactions){
      await prismaclient.transaction.findFirst({
        where: {
          isApproved: false,
          isPending: true,
          isCanceled:false,
          reversed:false,
          amount:-Math.abs(amount),
          type:"RETRAIT"
        }
      });
    }

    if (pendingTransactions){
      prismaclient.transaction.update({
        where: { id: pendingTransactions.id },
        data: { isApproved: true, isPending: false }
      })
      if (pendingTransactions.type=="RETRAIT")
        {
          await prismaclient.user.update({
            where: { id: req.userId },
            data: { balance: { increment: Math.abs(amount) } },
          });
      } await prismaclient.user.update({
        where: { id: req.userId },
        data: { balance: { decrement: Math.abs(amount) } },
      });

      
    }
    

      

    return res.status(201).json({ message: "Moneyflow entry created successfully"+pendingTransactions?"and transaction confirmed":"", moneyflow });
  } catch (error) {
    console.error("Error creating Moneyflow entry:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createMoneyflow = async (req, res) => {
  // Check if the user has the necessary finance permissions
  if (!req.isFinance) {
    return res.status(403).json({ error: "Unauthorized: Finance permissions required" });
  }

  // Destructure the money flow entries array from the request body
  const { entries } = req.body;

  // Validate that entries is an array
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: "Entries should be a non-empty array" });
  }

  try {
    // Process each entry in the array
    const results = await Promise.all(entries.map(async (entry) => {
      const { amount, phonenumeber, ID, type,id } = entry;

      
     
      if (!ID||!amount || !type) {
        return { error: "Missing required fields: amount, ID, and type are required", entry };
      }


      // Validate the transaction type
      if (!['RECEIVED', 'SENT'].includes(type)) {
        return { error: "Invalid type: Must be 'RECEIVED' or 'SENT'", entry };
      }

      // Create a new Moneyflow entry
      
     let moneyflow;
      let pendingTransaction;
       
      if ('RECEIVED'==type) {
       pendingTransaction = await prismaclient.transaction.findFirst({
        where: {
          isApproved: false,
          isPending: true,
          isCanceled: false,
          reversed: false,
          amount: amount,
          ID: ID.toUpperCase(),
          transactionType: "DEPO",
        },
      });}

      else {
        pendingTransaction = await prismaclient.transaction.findFirst({
          where: {
            isApproved: false,
            isPending: true,
            isCanceled: false,
            reversed: false,
            amount: -Math.abs(amount),
            transactionType: "RETRAIT",
            id:id
          },
        });
      }

      if (pendingTransaction) {
        moneyflow = await prismaclient.moneyflow.create({
          data: {
            amount,
            phonenumeber: phonenumeber || null,
            isApproved: true, // Default approval status; adjust if necessary
            ID: ID.toUpperCase(), // Normalize ID for consistency
            type,
          },
        });


        if (pendingTransaction.transactionType === "DEPO") {
         // console.log("DEPO")
          await prismaclient.user.update({
            where: { id: req.userId },
            data: { balance: { increment: Math.abs(amount) } },
          });
          await prismaclient.transaction.update({
            where: {
              id:  pendingTransaction.id ,  // Exclude the confirmed transaction
            },
            data: { amount:amount ,isApproved: true, isPending: false },
          });
          await prismaclient.transaction.updateMany({
            where: {
              ID: ID.toUpperCase(),
              isApproved: false,
              isPending: true,
              isCanceled: false,
              reversed: false,
              transactionType: "DEPO",
              id: { not: pendingTransaction.id },  // Exclude the confirmed transaction
            },
            data: { isCanceled: true,isPending: false,amount:amount },
          });
          
        } else {
          if (!id) {
            return { error: "Missing required field:  id incase of deposit", entry };
          }
          await prismaclient.user.update({
            where: { id: req.userId },
            data: { balance: { decrement: Math.abs(amount) } },
          });
          await prismaclient.transaction.update({
            where: {
              id:  pendingTransaction.id ,  // Exclude the confirmed transaction
            },
            data: { amount:amount,ID:ID ,isApproved: true, isPending: false},
          });
          await prismaclient.transaction.updateMany({
            where: {
              transactionType: "RETRAIT",
              isApproved: false,
              isPending: true,
              isCanceled: false,
              reversed: false,
              id: { not: pendingTransaction.id },  // Exclude the confirmed transaction
            },
            data: { isCanceled: true,isPending: false },
          });
        }
        
        //console.log(pendingTransaction.id)
        
      }
      // Cancel all other pending transactions with the same ID
     
      return pendingTransaction?{ success: true, message: "Moneyflow entry created successfully", moneyflow }:{ success: false, message: "no pending transaction", moneyflow};
    }));

    // Check for any errors in the results
    const errors = results.filter((result) => result.error);
    const successEntries = results.filter((result) => result.success);

    return res.status(201).json({
      message: `${successEntries.length} Moneyflow entries created successfully`,
      results,
      errors: errors.length ? errors : null,
    });
  } catch (error) {
    console.error("Error creating Moneyflow entries:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};


export const updateMoneyflow = async (req, res) => {
  // Check if the user has the necessary admin permissions
  if (!req.isAdmin) {
    return res.status(403).json({ error: "Unauthorized: Admin permissions required" });
  }

  // Get the Moneyflow ID from the request parameters and the updated data from the request body
  const { id } = req.params;
  const { amount, details, phonenumeber,  isApproved, ID, type } = req.body;

  // Validate the transaction type if it's provided
  if (type && !['RECEIVED', 'SENT'].includes(type)) {
    return res.status(400).json({ error: "Invalid type: Must be 'RECEIVED' or 'SENT'" });
  }

  try {
    // Update the Moneyflow entry with the provided data
    const updatedMoneyflow = await prisma.moneyflow.update({
      where: { id },
      data: {
        ...(amount !== undefined && { amount }),
        ...(details !== undefined && { details }),
        ...(phonenumeber !== undefined && { phonenumeber }),
        ...(isApproved !== undefined && { isApproved }),
        ...(ID !== undefined && { ID: ID.toUpperCase() }),
        ...(type !== undefined && { type })
      }
    });

    return res.status(200).json({ message: "Moneyflow entry updated successfully", updatedMoneyflow });
  } catch (error) {
    console.error("Error updating Moneyflow entry:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};


export const deleteMoneyflow = async (req, res) => {
  // Check if the user has the necessary admin permissions
  if (!req.isAdmin) {
    return res.status(403).json({ error: "Unauthorized: Admin permissions required" });
  }

  // Get the Moneyflow ID from the request parameters
  const { id } = req.params;

  try {
    // Delete the Moneyflow entry
    await prisma.moneyflow.delete({
      where: { id }
    });

    return res.status(200).json({ message: "Moneyflow entry deleted successfully" });
  } catch (error) {
    console.error("Error deleting Moneyflow entry:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};


export const getAllMoneyFlow = async (req, res) => {
  try {
    const flows = await prismaclient.moneyflow.findMany();

    res.status(200).json({MoneyFlow:flows,count:flows.length});
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to retrieve subscriptions' });
  }
};



// Helper function to get Base64 string of an image file
const getImageBase64 = (imagePath) => {
  try {
    const filePath = path.resolve(imagePath);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return null; // Return null or an empty string if the file doesn't exist
    }
    const image = fs.readFileSync(filePath);
    return Buffer.from(image).toString('base64');
  } catch (error) {
    console.error(`Failed to read image at path: ${imagePath}`, error);
    return null;
  }
};
// Updated getUserTransactions function
export const getUserTransactions = async (req, res) => {
  const userId = req.userId;

  try {
    // Check if user exists
    const user = await prismaclient.user.findUnique({
      where: { id: userId }
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Fetch transactions for the user
    const transactions = await prismaclient.transaction.findMany({
      where: { userId: userId },
      include: {
        subscription: true,
        download: true,
      }
    });
    
    // Map through each transaction and add the image data in Base64 format if available
    const transactionsWithImages = transactions.map(transaction => {
      const imagePath = transaction?.details[0];
      const imageBase64 = imagePath ? getImageBase64(path.resolve(imagePath)) : null;
      return { ...transaction, imageBase64 };
    });
    
    res.status(200).json(transactionsWithImages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Updated getAllTransactions function (Admin Only)
export const getAllTransactions = async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: "Admin privileges required" });
  }

  try {
    // Fetch all transactions
    const transactions = await prismaclient.transaction.findMany({
      include: {
        user: true,
        subscription: true,
        download: true,
      }
    });
    
    // Map through each transaction to add image data in Base64 format if available
    const transactionsWithImages = transactions.map(transaction => {
      const imagePath = transaction?.details[0];
      const imageBase64 = imagePath ? getImageBase64(path.resolve(imagePath)) : null;
      return { ...transaction, imageBase64 };
    });
    
    res.status(200).json(transactionsWithImages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};


// Updated getAllTransactions function (Admin Only)
export const getTransaction = async (req, res) => {
  {userId,id}
  if (!req.isAdmin) {
    return res.status(403).json({ error: "Admin privileges required" });
  }

  try {
    // Fetch all transactions
    const transaction = await prismaclient.transaction.findUnique({
      where:{userId,id},
      include: {
        user: true,
        subscription: true,
        download: true,
      }
    });
    
    // Map through each transaction to add image data in Base64 format if available
   
      const imagePath = transaction?.details[0];
      const imageBase64 = imagePath ? getImageBase64(path.resolve(imagePath)) : null;
    res.status(200).json({ ...transaction, imageBase64 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};


export const createDepositTransactionByAdmin = async (req, res) => {
  // Check if the user has admin privileges
  
  if (!req.isAdmin) {
    return res.status(403).json({ error: "Admin privileges required" });
  }

  const { userId, amount,  transactionType = "DEPO"} = req.body;

  // Validate required fields
  if (!userId || !amount ) {
    return res.status(400).json({ error: "userId, amount are required" });
  }

  try {
    // Check if user exists
    const user = await prismaclient.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Create the transaction
    const transaction = await prismaclient.transaction.create({
      data: {
        userId: user.id,
        amount:Math.abs(parseFloat(amount)) ,
        transactionType,
        details: [],
        isApproved: true,   // Marking as approved directly since admin is creating it
        isPending: false,
        onlyAdminSee: true, // Visible only to admin
        ID: `DEPO-${Date.now()}-${Math.floor(Math.random() * 10000)}byAdmin`,
        phonenumber:"ADMINDEPO" // Unique transaction ID
      }
    });

    // Update the user's balance
    await prismaclient.user.update({
      where: { id: user.id },
      data: {
        balance: user.balance + Math.abs(parseFloat(amount))
      }
    });

    res.status(201).json({ message: "Deposit transaction created successfully", transaction });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};