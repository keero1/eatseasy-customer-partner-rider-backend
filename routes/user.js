const router = require("express").Router();
const userController = require("../controllers/userController");
const {verifyTokenAndAuthorization, verifyAdmin}= require("../middlewares/verifyToken")


// UPADATE USER
router.put("/",verifyTokenAndAuthorization, userController.updateUser);

router.get("/verify/:otp",verifyTokenAndAuthorization, userController.verifyAccount);
router.get("/verify_phone/:phone",verifyTokenAndAuthorization, userController.verifyPhone);

// DELETE USER

router.delete("/" , verifyTokenAndAuthorization, userController.deleteUser);

// GET USER

router.get("/",verifyTokenAndAuthorization, userController.getUser);

// Add Skills



module.exports = router