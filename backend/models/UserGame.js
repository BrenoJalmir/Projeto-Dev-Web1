const mongoose = require("mongoose");

const userGameSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    game: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Game",
      required: true,
    },
    status: {
      type: String,
      enum: ["planned", "playing", "completed", "dropped", "paused"],
      default: "planned",
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    platform: {
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
    hoursPlayed: {
      type: Number,
      default: 0,
      min: 0,
    },
    dateAdded: {
      type: Date,
      default: Date.now,
    },
    dateStarted: {
      type: Date,
      default: null,
    },
    dateCompleted: {
      type: Date,
      default: null,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    notes: {
      type: String,
      maxlength: 1000,
      default: "",
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    achievements: [
      {
        name: String,
        description: String,
        unlockedAt: Date,
      },
    ],
  },
  {
    timestamps: true,
  }
);

userGameSchema.index({ user: 1, game: 1 }, { unique: true });
userGameSchema.index({ user: 1, status: 1 });
userGameSchema.index({ user: 1, rating: 1 });
userGameSchema.index({ user: 1, isFavorite: 1 });

userGameSchema.pre("save", async function (next) {
  if (this.isModified("status")) {
    if (this.status === "playing" && !this.dateStarted) {
      this.dateStarted = new Date();
    }

    if (this.status === "completed" && !this.dateCompleted) {
      this.dateCompleted = new Date();
      this.progress = 100;
    }

    if (this.status === "dropped" || this.status === "paused") {
      this.dateCompleted = null;
    }
  }

  next();
});

userGameSchema.post("save", async function () {
  const User = require("./User");
  const Game = require("./Game");

  try {
    const user = await User.findById(this.user);
    const game = await Game.findById(this.game);

    if (user) {
      await user.updateStats();
    }

    if (game) {
      await game.updateRating();
      await game.updateStats();
    }
  } catch (error) {
    console.error("Error updating stats:", error);
  }
});

userGameSchema.post(
  "deleteOne",
  { document: true, query: false },
  async function () {
    const User = require("./User");
    const Game = require("./Game");

    try {
      const user = await User.findById(this.user);
      const game = await Game.findById(this.game);

      if (user) {
        await user.updateStats();
      }

      if (game) {
        await game.updateRating();
        await game.updateStats();
      }
    } catch (error) {
      console.error("Error updating stats after deletion:", error);
    }
  }
);

userGameSchema.methods.updateProgress = function (newProgress) {
  this.progress = Math.max(0, Math.min(100, newProgress));

  if (this.progress === 100 && this.status !== "completed") {
    this.status = "completed";
    this.dateCompleted = new Date();
  }

  return this.save();
};

userGameSchema.statics.getUserStats = async function (userId) {
  const stats = await this.aggregate([
    { $match: { user: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalHours: { $sum: "$hoursPlayed" },
        avgRating: { $avg: "$rating" },
      },
    },
  ]);

  const result = {
    total: 0,
    planned: 0,
    playing: 0,
    completed: 0,
    dropped: 0,
    paused: 0,
    totalHours: 0,
    averageRating: 0,
  };

  stats.forEach((stat) => {
    result[stat._id] = stat.count;
    result.total += stat.count;
    result.totalHours += stat.totalHours || 0;

    if (stat.avgRating) {
      result.averageRating = stat.avgRating;
    }
  });

  return result;
};

module.exports = mongoose.model("UserGame", userGameSchema);
