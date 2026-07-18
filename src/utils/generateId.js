const Counter = require("../models/counter");

exports.generateSequence = async (counterName) => {
    const counter = await Counter.findOneAndUpdate(
        { id: counterName },
        { $inc: { seq: 1 } },
        { returnDocument: 'after', upsert: true }
    );

    return counter.seq;
};