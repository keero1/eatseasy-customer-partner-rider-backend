const router = require("express").Router();
const cartController = require("../controllers/cartController");
const {verifyTokenAndAuthorization, verifyAdmin} = require("../middlewares/verifyToken")


// UPADATE category
router.put("/", verifyTokenAndAuthorization, cartController.addProductToCart);

router.post("/decrement",verifyTokenAndAuthorization, cartController.decrementProductQuantity);

router.post("/increment",verifyTokenAndAuthorization, cartController.incrementProductQuantity);

router.delete("/delete/:id",verifyTokenAndAuthorization, cartController.removeProductFromCart);

router.get("/",verifyTokenAndAuthorization, cartController.fetchUserCart);

router.get("/count",verifyTokenAndAuthorization, cartController.getCartCount);

router.delete("/clear/:id",verifyTokenAndAuthorization, cartController.clearUserCart);

module.exports = router