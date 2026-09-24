import { Schema, model } from "mongoose";

const userSchema = new Schema(
	{
		name: {
			type: String,
			required: [true, "Name is required"],
			unique: true,
			trim: true,
		},
		password: {
			type: String,
			minlength: [6, "Password must be at least 6 characters long"],
			required: [true, "Password is required"],
			select: false,
		}
	},
	{ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

const UserModel = model("user", userSchema);

export default UserModel;
