const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
    {
        username: { type: String, required: true, unique: true },
        email: { type: String, required: true, unique: true },
        uid: { type: String, required: true, unique: true},
        password: { type: String, required: true },
        address: { type: Array, required: false },
        phone: { type: String, required: false },
        userType: { type: String, required: true, enum: ['Admin', 'Driver', 'Vendor', 'Client'] },
        profile: {
            type: String,
            require: true,
            default: "https://d326fntlu7tb1e.cloudfront.net/uploads/bdec9d7d-0544-4fc4-823d-3b898f6dbbbf-vinci_03.jpeg"
        },

    }, { timestamps: true }
);
module.exports = mongoose.model("User", UserSchema)