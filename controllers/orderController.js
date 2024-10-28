const Order = require("../models/Orders");
const Driver = require("../models/Driver");
const admin = require("firebase-admin");
const {
  updateDriver,
  updateRestaurant,
  updateUser,
} = require("../utils/driver_update");
const sendNotification = require("../utils/sendNotification");
const Restaurant = require("../models/Restaurant");
const User = require("../models/User");
const sendNotificationToTopic = require("../utils/send_to_topic");

module.exports = {
  placeOrder: async (req, res) => {
    const order = new Order({
      userId: req.body.userId,
      orderItems: req.body.orderItems,
      orderTotal: parseFloat(req.body.orderTotal), // Convert to double
      deliveryFee: parseFloat(req.body.deliveryFee), // Assuming you want to convert this as well
      grandTotal: parseFloat(req.body.grandTotal),
      unitPrice: parseFloat(req.body.unitPrice), // And this too
      restaurantAddress: req.body.restaurantAddress,
      paymentMethod: req.body.paymentMethod,
      restaurantId: req.body.restaurantId,
      restaurantCoords: req.body.restaurantCoords,
      recipientCoords: req.body.recipientCoords,
      deliveryAddress: req.body.deliveryAddress,
      deliveryOption: req.body.deliveryOption,
      deliveryDate: req.body.deliveryDate,
    });

    try {
      await order.save();
      const orderId = order.id;
      res
        .status(201)
        .json({
          status: true,
          message: "Order placed successfully",
          orderId: orderId,
        });
    } catch (error) {
      res.status(500).json({ status: false, message: error.message });
    }
  },

  getOrderDetails: async (req, res) => {
      const orderId = req.params.id;

      try {
          let order = await Order.findById(orderId)
              .select(
                  "userId deliveryAddress orderItems deliveryFee restaurantId restaurantCoords recipientCoords orderStatus driverId"
              )
              .populate({ path: "userId", select: "phone profile" })
              .populate({ path: "restaurantId", select: "title coords imageUrl logoUrl time" })
              .populate({ path: "orderItems.foodId", select: "title imageUrl time" })
              .populate({ path: "deliveryAddress", select: "addressLine1" })
              .populate({
                  path: "driverId",
                  select: "phone vehicleNumber currentLocation driver",
                  populate: { path: "driver", select: "username profile" }
              });

          if (order && (order.orderStatus === "Out_for_Delivery" || order.orderStatus === "Delivered")) {
              const driver = await Driver.findById(order.driverId).select("currentLocation");
              order = order.toObject(); // Convert Mongoose document to a plain JS object
              order.driverId.currentLocation = driver.currentLocation;
          }

          if (order) {
              res.status(200).json(order);
          } else {
              res.status(404).json({ status: false, message: "Order not found" });
          }
      } catch (error) {
          res.status(500).json({ status: false, message: error.message });
      }
  },


  getUserOrders: async (req, res) => {
    const userId = req.user.id;
    const { paymentStatus, orderStatus } = req.query;

    let query = { userId };

    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    if (orderStatus) {
      query.orderStatus = orderStatus;
    }

    try {
      const orders = await Order.find(query)
        .populate({
          path: "orderItems.foodId",
          select: "imageUrl title rating time",
        })
        .sort({ updatedAt: -1 });
      // .populate('driverId');

      return res.status(200).json(orders);
    } catch (error) {
      res.status(500).json(error);
    }
  },

  deleteOrder: async (req, res) => {
    const { orderId } = req.params;

    try {
      await Order.findByIdAndDelete(orderId);
      res
        .status(200)
        .json({ status: true, message: "Order deleted successfully" });
    } catch (error) {
      res.status(500).json(error);
    }
  },

  rateOrder: async (req, res) => {
    const orderId = req.params.id;
    const { rating, feedback } = req.body;

    try {
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { rating, feedback },
        { new: true }
      );
      if (updatedOrder) {
        res
          .status(200)
          .json({
            status: true,
            message: "Rating and feedback added successfully",
            data: updatedOrder,
          });
      } else {
        res.status(404).json({ status: false, message: "Order not found" });
      }
    } catch (error) {
      res.status(500).json(error);
    }
  },

  updateOrderStatus: async (req, res) => {
    const orderId = req.params.id;
    const { orderStatus } = req.body;

    //firebase here we including {{orderid: id, status}}

    try {
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { orderStatus },
        { new: true }
      );
      if (updatedOrder) {
        res
          .status(200)
          .json({
            status: true,
            message: "Order status updated successfully",
            data: updatedOrder,
          });
      } else {
        res.status(404).json({ status: false, message: "Order not found" });
      }
    } catch (error) {
      res.status(500).json(error);
    }
  },

  updatePaymentStatus: async (req, res) => {
    const orderId = req.params.id;

    try {
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { paymentStatus: "Completed" },
        { new: true }
      )
        .select(
          "userId deliveryAddress orderItems deliveryFee restaurantId restaurantCoords recipientCoords orderStatus"
        )
        .populate({
          path: "userId",
          select: "phone profile", // Replace with actual field names for suid
        })
        .populate({
          path: "restaurantId",
          select: "title coords imageUrl logoUrl time", // Replace with actual field names for courier
        })
        .populate({
          path: "orderItems.foodId",
          select: "title imageUrl time", // Replace with actual field names for courier
        })
        .populate({
          path: "deliveryAddress",
          select: "addressLine1 city district", // Replace with actual field names for courier
        });
      if (updatedOrder) {
        res
          .status(200)
          .json({
            status: true,
            message: "Payment status updated successfully",
            data: updatedOrder,
          });
      } else {
        res.status(404).json({ status: false, message: "Order not found" });
      }
    } catch (error) {
      res.status(500).json(error);
    }
  },

  getRestaurantOrders: async (req, res) => {
    let status;
    if (req.query.status === "placed") {
      status = "Placed";
    } else if (req.query.status === "preparing") {
      status = "Preparing";
    } else if (req.query.status === "ready") {
      status = "Ready";
    } else if (req.query.status === "out_for_delivery") {
      status = "Out_for_Delivery";
    } else if (req.query.status === "delivered") {
      status = "Delivered";
    } else if (req.query.status === "manual") {
      status = "Manual";
    } else if (req.query.status === "cancelled") {
      status = "Cancelled";
    }
    try {
      const parcels = await Order.find({
        orderStatus: status,
        restaurantId: req.params.id,
        paymentStatus: "Completed",
      })
        .select(
          "userId deliveryAddress orderItems deliveryFee restaurantId restaurantCoords recipientCoords orderStatus"
        )
        .populate({
          path: "userId",
          select: "phone profile", // Replace with actual field names for suid
        })
        .populate({
          path: "restaurantId",
          select: "title coords imageUrl logoUrl time", // Replace with actual field names for courier
        })
        .populate({
          path: "orderItems.foodId",
          select: "title imageUrl time", // Replace with actual field names for courier
        });

      res.status(200).json(parcels);
    } catch (error) {
      res
        .status(500)
        .json({
          status: false,
          message: "Error retrieving parcels",
          error: error.message,
        });
    }
  },

  getRestaurantOrdersList: async (req, res) => {
    let status;
    if (req.query.status === "placed") {
      status = "Placed";
    } else if (req.query.status === "preparing") {
      status = "Preparing";
    } else if (req.query.status === "ready") {
      status = "Ready";
    } else if (req.query.status === "out_for_delivery") {
      status = "Out_for_Delivery";
    } else if (req.query.status === "delivered") {
      status = "Delivered";
    } else if (req.query.status === "manual") {
      status = "Manual";
    } else if (req.query.status === "cancelled") {
      status = "Cancelled";
    }
    try {
      const parcels = await Order.find({
        orderStatus: status,
        restaurantId: req.params.id,
        paymentStatus: "Completed",
      })
        .select(
          "userId deliveryAddress orderItems deliveryFee restaurantId orderStatus restaurantCoords recipientCoords orderDate"
        )
        .populate({
          path: "userId",
          select: "phone profile", // Replace with actual field names for suid
        })
        .populate({
          path: "restaurantId",
          select: "title imageUrl logoUrl time", // Replace with actual field names for courier
        })
        .populate({
          path: "orderItems.foodId",
          select: "title imageUrl time", // Replace with actual field names for courier
        })
        .populate({
          path: "deliveryAddress",
          select: "addressLine1", // Replace with actual field names for courier
        });

     // console.log("getting the list",parcels);
      res.status(200).json(parcels);
    } catch (error) {

      res
        .status(500)
        .json({
          status: false,
          message: "Error retrieving parcels",
          error: error.message,
        });
    }
  },

  getNearbyOrders: async (req, res) => {
    try {
      const parcels = await Order.find({
        orderStatus: req.params.status,
        paymentStatus: "Completed",
      })
        .select(
          "userId deliveryAddress orderItems deliveryFee restaurantId restaurantCoords recipientCoords orderStatus"
        )
        .populate({
          path: "userId",
          select: "phone profile username", // Replace with actual field names for suid
        })
        .populate({
          path: "restaurantId",
          select: "title coords imageUrl logoUrl time", // Replace with actual field names for courier
        })
        .populate({
          path: "orderItems.foodId",
          select: "title imageUrl time", // Replace with actual field names for courier
        })
        .populate({
          path: "deliveryAddress",
          select: "addressLine1 city district deliveryInstructions", // Replace with actual field names for courier
        });

      res.status(200).json(parcels);
    } catch (error) {
      res
        .status(500)
        .json({
          status: false,
          message: "Error retrieving parcels",
          error: error.message,
        });
    }
  },

  getPickedOrders: async (req, res) => {
    let status;
    if (req.params.status === "Out_for_Delivery") {
      status = "Out_for_Delivery";
    } else if (req.params.status === "Delivered") {
      status = "Delivered";
    } else if (req.params.status === "Accepted") {
      status = "Accepted";
    } else if (req.params.status === "Manual") {
      status = "Manual";
    } else {
      status = "Cancelled";
    }
    try {
      const parcels = await Order.find({
        orderStatus: status,
        driverId: req.params.driver,
      })
        .select(
          "userId deliveryAddress orderItems deliveryFee restaurantId restaurantCoords recipientCoords orderStatus"
        )
        .populate({
          path: "userId",
          select: "phone profile username", // Replace with actual field names for suid
        })
        .populate({
          path: "restaurantId",
          select: "title coords imageUrl logoUrl time", // Replace with actual field names for courier
        })
        .populate({
          path: "orderItems.foodId",
          select: "title imageUrl time", // Replace with actual field names for courier
        })
        .populate({
          path: "deliveryAddress",
          select: "addressLine1 deliveryInstructions", // Replace with actual field names for courier
        });

      res.status(200).json(parcels);
    } catch (error) {
      res
        .status(500)
        .json({
          status: false,
          message: "Error retrieving parcels",
          error: error.message,
        });
    }
  },

  orderAccepted: async (req, res) => {
      const orderId = req.params.id;
      const driver = req.params.driverId;
      const status = "Accepted";

      try {
          const updatedOrder = await Order.findByIdAndUpdate(
              orderId,
              { orderStatus: "Accepted", driverId: driver },
              { new: true }
          )
          .select(
              "userId deliveryAddress orderItems deliveryFee restaurantId restaurantCoords recipientCoords orderStatus"
          )
          .populate({
              path: "userId",
              select: "phone profile fcm username", // Replace with actual field names for suid
          })
          .populate({
              path: "restaurantId",
              select: "title coords imageUrl logoUrl time", // Replace with actual field names for courier
          })
          .populate({
              path: "orderItems.foodId",
              select: "title imageUrl time", // Replace with actual field names for courier
          })
          .populate({
              path: "deliveryAddress",
              select: "addressLine1 city district deliveryInstructions", // Replace with actual field names for courier
          });

          const user = await User.findById(updatedOrder.userId._id, { fcm: 1 });

          if (updatedOrder) {
              const data = {
                  orderId: updatedOrder._id.toString(),
                  messageType: "order",
              };
              const db = admin.database();

              if (user.fcm || user.fcm !== null || user.fcm !== "") {
                  sendNotification(
                      user.fcm,
                      "📦 Order Accepted",
                      data,
                      `Your order has been accepted and is being prepared.`
                  );
              }

              updateUser(updatedOrder, db, status);
              res.status(200).json(updatedOrder);
          } else {
              res.status(404).json({ status: false, message: "Order not found" });
          }
      } catch (error) {
          res.status(500).json({ status: false, message: error.message });
      }
  },

  orderPicked: async (req, res) => {
    const orderId = req.params.id;
    const status = "Out_for_Delivery";

    try {
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { orderStatus: "Out_for_Delivery" },
        { new: true }
      )
        .select(
          "userId deliveryAddress orderItems deliveryFee restaurantId restaurantCoords recipientCoords orderStatus"
        )
        .populate({
          path: "userId",
          select: "phone profile fcm username", // Replace with actual field names for suid
        })
        .populate({
          path: "restaurantId",
          select: "title coords imageUrl logoUrl time", // Replace with actual field names for courier
        })
        .populate({
          path: "orderItems.foodId",
          select: "title imageUrl time", // Replace with actual field names for courier
        })
        .populate({
          path: "deliveryAddress",
          select: "addressLine1 city district deliveryInstructions", // Replace with actual field names for courier
        });

      const user = await User.findById(updatedOrder.userId._id, { fcm: 1 });

      if (updatedOrder) {
        const data = {
          orderId: updatedOrder._id.toString(),
          messageType: "order",
        };
        const db = admin.database();

        if (user.fcm || user.fcm !== null || user.fcm !== "") {
          sendNotification(
            user.fcm,
            "🚚 Order Picked Up and Out for Delivery",
            data,
            `Your order has been picked up and now getting delivered.`
          );
        }

        updateUser(updatedOrder, db, status);
        res.status(200).json(updatedOrder);
      } else {
        res.status(404).json({ status: false, message: "Order not found" });
      }
    } catch (error) {
      res.status(500).json({ status: false, message: error.message });
    }
  },

  orderDelivered: async (req, res) => {
    const orderId = req.params.id;
    const status = "Delivered";
    const userId = req.user.id;

    try {
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { orderStatus: "Delivered" },
        { new: true }
      )
        .select(
          "userId orderTotal deliveryAddress orderItems deliveryFee restaurantId restaurantCoords recipientCoords orderStatus"
        )
        .populate({
          path: "userId",
          select: "phone profile fcm username", // Replace with actual field names for suid
        })
        .populate({
          path: "restaurantId",
          select: "title coords imageUrl logoUrl time", // Replace with actual field names for courier
        })
        .populate({
          path: "orderItems.foodId",
          select: "title imageUrl time", // Replace with actual field names for courier
        })
        .populate({
          path: "deliveryAddress",
          select: "addressLine1 deliveryInstructions", // Replace with actual field names for courier
        });

      await Restaurant.findByIdAndUpdate(
        updatedOrder.restaurantId._id,
        {
          $inc: { earnings: updatedOrder.orderTotal },
        },
        { new: true }
      );

      const driver = await Driver.findOne({ driver: userId });

      if (updatedOrder) {
        const data = {
          orderId: updatedOrder._id.toString(),
          messageType: "order",
        };
        const db = admin.database();
        updateRestaurant(updatedOrder, db, status);
        updateUser(updatedOrder, db, status);

        const user = await User.findById(updatedOrder.userId._id, { fcm: 1 });

        if (user.fcm || user.fcm !== null || user.fcm !== "") {
          sendNotification(
            user.fcm,
            "🎊 Food Delivered 🎉",
            data,
            `Thank you for ordering from us! Your order has been successfully delivered.`
          );
        }

        if (driver) {
          driver.totalDeliveries = +1;
          driver.totalEarnings =
            driver.totalEarnings + updatedOrder.deliveryFee;
        }

        await driver.save();
        res.status(200).json(updatedOrder);
      } else {
        res.status(404).json({ status: false, message: "Order not found" });
      }
    } catch (error) {
      res.status(500).json({ status: false, message: error.message });
    }
  },

  processOrder: async (req, res) => {
    const orderId = req.params.id;
    const status = req.params.status;
    try {
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { orderStatus: status },
        { new: true }
      )
        .select(
          "userId deliveryAddress orderItems deliveryFee restaurantId restaurantCoords recipientCoords orderStatus"
        )
        .populate({
          path: "userId",
          select: "phone profile username", // Replace with actual field names for suid
        })
        .populate({
          path: "restaurantId",
          select: "title coords imageUrl logoUrl time", // Replace with actual field names for courier
        })
        .populate({
          path: "orderItems.foodId",
          select: "title imageUrl time", // Replace with actual field names for courier
        })
        .populate({
          path: "deliveryAddress",
          select: "addressLine1 city district deliveryInstructions", // Replace with actual field names for courier
        });
      const user = await User.findById(updatedOrder.userId._id, { fcm: 1 });

      if (user) {
        if (updatedOrder) {
          const data = {
            orderId: updatedOrder._id.toString(),
            messageType: "order",
          };

          if (status === "Preparing") {
            if (user.fcm || user.fcm !== null || user.fcm !== "") {
              sendNotification(
                user.fcm,
                "👩‍🍳 Order Accepted and Preparing",
                data,
                `Your order is being prepared and will be ready soon`
              );
            }
          } else if (status === "Ready") {
            if (user.fcm || user.fcm !== null || user.fcm !== "") {
              sendNotificationToTopic(data);
              sendNotification(
                user.fcm,
                "🚚 Order Awaits Pick Up",
                data,
                `Your order prepared and is waiting to be picked up`
              );
            }
          } else if (status === "Out_for_Delivery" || status === "Manual") {
            if (user.fcm || user.fcm !== null || user.fcm !== "") {
              sendNotification(
                user.fcm,
                "🚚 Order Picked Up and Out for Delivery",
                data,
                `Your order has been picked up and now getting delivered.`
              );
            }
          } else if (status === "Delivered") {
            console.log(
              updatedOrder.restaurantId._id,
              updatedOrder.orderTotal
            );
          

            const orderTotal = updatedOrder.orderTotal ?? 0; // Use 0 if orderTotal is null or undefined

            if (orderTotal) {
              await Restaurant.findByIdAndUpdate(
                updatedOrder.restaurantId._id,
                {
                  $inc: { earnings: orderTotal },
                },
                { new: true }
              );
            } else {
              console.log("Order total is null or undefined, no update made.");
            }

            if (user.fcm || user.fcm !== null || user.fcm !== "") {
                console.log("Sending notification to user fcm ", user.fcm);
              sendNotification(
                user.fcm,
                "🎊 Food Delivered 🎉",
                data,
                `Thank you for ordering from us! Your order has been successfully delivered.`
              );
              console.log("Sent notification to user");
            }else{
                console.log("Did not notification to user");
            }
          } else if (status === "Cancelled") {
            if (user.fcm || user.fcm !== null || user.fcm !== "") {
              sendNotification(
                user.fcm,
                `💔 Order Cancelled`,
                data,
                `Your order has been cancelled. Contact the restaurant for more information`
              );
            }
          }

          res.status(200).json(updatedOrder);
        } else {
          res.status(404).json({ status: false, message: "Order not found" });
        }
      }
    } catch (error) {

      res.status(500).json({ status: false, message: error.message });
    }
  },

  getDeliveredOrders: async (req, res) => {
    const userId = req.user.id;
    const status = "Delivered";
    
    try {
      // Find the driver using the userId
      const driver = await Driver.findOne({ driver: userId });
  
      if (!driver) {
        return res.status(404).json({ status: false, message: "Driver not found" });
      }else{
        console.log(driver._id);
      }
  
      // Fetch delivered orders for the driver
      const deliveredOrders = await Order.find({ orderStatus: status, driverId: driver._id })
        .select("userId orderTotal deliveryAddress orderItems deliveryFee restaurantId restaurantCoords recipientCoords orderStatus")
        .populate({
          path: "userId",
          select: "phone profile fcm username",
        })
        .populate({
          path: "restaurantId",
          select: "title coords imageUrl logoUrl time",
        })
        .populate({
          path: "orderItems.foodId",
          select: "title imageUrl time",
        })
        .populate({
          path: "deliveryAddress",
          select: "addressLine1 deliveryInstructions",
        });
  
      if (deliveredOrders.length > 0) {
        return res.status(200).json( deliveredOrders );
      } else {
        return res.status(404).json({ status: false, message: "No delivered orders found" });
      }
    } catch (error) {
      return res.status(500).json({ status: false, message: error.message });
    }
  }
};
