import { Schema, model } from 'mongoose';

const TokenSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'user',
            required: true,
            unique: true,
            index: true
        },
        token: {
            type: String,
            required: true
        }
    },
    { versionKey: false, }
);

const TokenModel = model('Token', TokenSchema);
export default TokenModel;
