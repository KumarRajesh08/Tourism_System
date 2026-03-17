const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

const mongoUrl = process.env.ATLASDB_URL;

main()
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(mongoUrl);
}

const initDB = async () => {
  try {
    await Listing.deleteMany({});

    const updatedData = initData.data.map((obj) => {
      const { _id, reviews, __v, owner, ...rest } = obj;
      return {
        ...rest,
        owner: "66567b03fda820235197b582",
      };
    });

    await Listing.insertMany(updatedData);
    console.log("DB is initialized");
  } catch (error) {
    console.error("Error initializing DB:", error);
  } finally {
    mongoose.connection.close();
  }
};

initDB();

