// models/index.js
// Import all models from one place in your app:
// const { User, Post, Follow } = require("./models");

module.exports = {
  User:           require("./User"),
  Follow:         require("./Follow"),
  Post:           require("./Post"),
  Tag:            require("./Tag"),
  Reaction:       require("./Reaction"),
  Collection:     require("./Collection"),
  AnalyticsEvent: require("./AnalyticsEvent"),
  SearchIndex:    require("./SearchIndex"),
};
