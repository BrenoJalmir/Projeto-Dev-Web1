const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    developer: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    publisher: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    releaseDate: {
      type: Date,
      required: true,
    },
    genres: [
      {
        type: String,
        trim: true,
      },
    ],
    platforms: [
      {
        type: String,
        enum: [
          "PC",
          "PlayStation",
          "Xbox",
          "Nintendo Switch",
          "Mobile",
          "Mac",
          "Linux",
        ],
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    images: {
      cover: {
        type: String,
        required: true,
      },
      banner: {
        type: String,
        required: true,
      },
      screenshots: [String],
    },
    externalIds: {
      steamId: String,
      igdbId: String,
      metacriticId: String,
    },
    ratings: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 10,
      },
      count: {
        type: Number,
        default: 0,
      },
      distribution: {
        1: { type: Number, default: 0 },
        2: { type: Number, default: 0 },
        3: { type: Number, default: 0 },
        4: { type: Number, default: 0 },
        5: { type: Number, default: 0 },
      },
    },
    metadata: {
      ageRating: String,
      website: String,
      trailer: String,
      isEarlyAccess: {
        type: Boolean,
        default: false,
      },
      isReleased: {
        type: Boolean,
        default: true,
      },
    },
    stats: {
      totalPlayers: {
        type: Number,
        default: 0,
      },
      averagePlaytime: {
        type: Number,
        default: 0,
      },
      completionRate: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

gameSchema.index({ title: "text", description: "text", developer: "text" });
gameSchema.index({ "ratings.average": -1 });
gameSchema.index({ releaseDate: -1 });
gameSchema.index({ genres: 1 });
gameSchema.index({ platforms: 1 });

gameSchema.methods.updateRating = async function () {
  const UserGame = require("./UserGame");

  const userGames = await UserGame.find({
    game: this._id,
    rating: { $exists: true, $ne: null, $gt: 0 },
  });

  if (userGames.length === 0) {
    this.ratings.average = 0;
    this.ratings.count = 0;
    return await this.save();
  }

  const ratings = userGames.map((ug) => ug.rating);
  this.ratings.average =
    ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
  this.ratings.count = ratings.length;

  this.ratings.distribution = {
    1: ratings.filter((r) => r === 1).length,
    2: ratings.filter((r) => r === 2).length,
    3: ratings.filter((r) => r === 3).length,
    4: ratings.filter((r) => r === 4).length,
    5: ratings.filter((r) => r === 5).length,
  };

  await this.save();
};

gameSchema.methods.updateStats = async function () {
  const UserGame = require("./UserGame");

  const userGames = await UserGame.find({ game: this._id });

  this.stats.totalPlayers = userGames.length;

  const playedGames = userGames.filter(
    (ug) => ug.hoursPlayed && ug.hoursPlayed > 0
  );
  if (playedGames.length > 0) {
    this.stats.averagePlaytime =
      playedGames.reduce((sum, ug) => sum + ug.hoursPlayed, 0) /
      playedGames.length;
  }

  const completedGames = userGames.filter((ug) => ug.status === "completed");
  this.stats.completionRate =
    userGames.length > 0 ? (completedGames.length / userGames.length) * 100 : 0;

  await this.save();
};

gameSchema.statics.getPopular = function (limit = 20) {
  return this.find({ "metadata.isReleased": true })
    .sort({ "ratings.average": -1, "ratings.count": -1 })
    .limit(limit);
};

gameSchema.statics.getRecent = function (limit = 20) {
  return this.find({ "metadata.isReleased": true })
    .sort({ releaseDate: -1 })
    .limit(limit);
};

gameSchema.statics.getUpcoming = function (limit = 20) {
  return this.find({
    $or: [
      { "metadata.isReleased": false },
      { releaseDate: { $gt: new Date() } },
    ],
  })
    .sort({ releaseDate: 1 })
    .limit(limit);
};

module.exports = mongoose.model("Game", gameSchema);
