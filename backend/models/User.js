const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    bio: {
      type: String,
      maxlength: 500,
      default: "",
    },
    avatar: {
      type: String,
      default: "",
    },
    location: {
      type: String,
      maxlength: 100,
      default: "",
    },
    joinDate: {
      type: Date,
      default: Date.now,
    },
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    preferences: {
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      profileVisibility: {
        type: String,
        enum: ["public", "private", "friends"],
        default: "public",
      },
      showOnlineStatus: {
        type: Boolean,
        default: true,
      },
    },
    stats: {
      totalGames: {
        type: Number,
        default: 0,
      },
      completedGames: {
        type: Number,
        default: 0,
      },
      currentlyPlaying: {
        type: Number,
        default: 0,
      },
      totalHours: {
        type: Number,
        default: 0,
      },
      averageRating: {
        type: Number,
        default: 0,
      },
      reviewsWritten: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.verificationToken;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpires;
  return user;
};

userSchema.methods.updateStats = async function () {
  const UserGame = require("./UserGame");
  const Review = require("./Review");

  const userGames = await UserGame.find({ user: this._id });
  const reviews = await Review.find({ user: this._id });

  this.stats.totalGames = userGames.length;
  this.stats.completedGames = userGames.filter(
    (g) => g.status === "completed"
  ).length;
  this.stats.currentlyPlaying = userGames.filter(
    (g) => g.status === "playing"
  ).length;
  this.stats.totalHours = userGames.reduce(
    (sum, g) => sum + (g.hoursPlayed || 0),
    0
  );
  this.stats.reviewsWritten = reviews.length;

  const ratedGames = userGames.filter((g) => g.rating && g.rating > 0);
  if (ratedGames.length > 0) {
    this.stats.averageRating =
      ratedGames.reduce((sum, g) => sum + g.rating, 0) / ratedGames.length;
  }

  await this.save();
};

module.exports = mongoose.model("User", userSchema);
