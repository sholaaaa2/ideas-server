import { Schema, model } from "mongoose";

const scriptSchema = new Schema(
    {
        scenario: {
            type: String,
            required: [true, "scenario is required"],
            trim: true,
        },
        equipment: {
            type: String,
            trim: true,
        },
        actors: {
            type: String,
            trim: true,
        },
        device: {
            type: String,
            trim: true,
        },
        location: {
            type: String,
            trim: true,
        },
        difficulty: {
            type: String,
            trim: true,
            enum: {
                values: ["low", "mid", "high", ""],
                message: "Difficulty must be low, mid or high",
            },
            default: "",
        },
    },
    { _id: false, }
);

const IdeaSchema = new Schema(
    {
        url: {
            type: String,
            trim: true,
        },
        url_origin: {
            type: String,
            trim: true,
        },
        title: {
            type: String,
            required: [true, "Title is required"],
            trim: true,
        },
        scripts: {
            type: [scriptSchema],
            default: [],
        },
    },
    { timestamps: true, toJSON: { virtuals: true, }, toObject: { virtuals: true, }, }
);

IdeaSchema.index({ title: 1 });
IdeaSchema.index({"scripts.location": 1,});
IdeaSchema.index({"scripts.difficulty": 1,});

const IdeaModel = model("Idea",IdeaSchema);

export default IdeaModel;