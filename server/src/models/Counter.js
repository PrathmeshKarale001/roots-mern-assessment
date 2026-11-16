import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
      trim: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  {
    versionKey: false,
  }
);

counterSchema.statics.getNextSequence = async function getNextSequence(counterName) {
  const ret = await this.findOneAndUpdate(
    { _id: counterName },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return ret.seq;
};

export const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

export default Counter;
