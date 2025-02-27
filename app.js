//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const mongooseFieldEncryption = require("mongoose-field-encryption").fieldEncryption;
//const encrypt = require("mongoose-encryption");
//const md5 = require("md5");
// const bcrypt=require("bcrypt");
// const saltRounds = 10;
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");
const FacebookStrategy = require("passport-facebook").Strategy;

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.use(session({
  secret : process.env.SECRET,
  resave : false,
  saveUninitialized : false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb+srv://admin-saikat:Saikat1234@cluster0.0lni0.mongodb.net/userDB?retryWrites=true&w=majority",{useNewUrlParser:true,useUnifiedTopology:true});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  username : String,
  password : String,
  googleId : String,
  facebookId : String,
  secrets : [{
    type: String
  }]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
//userSchema.plugin(encrypt, {secret:process.env.SECRET, encryptedFields : ['secret']});
userSchema.plugin(mongooseFieldEncryption, { fields: ["secrets"], secret: process.env.SECRET });
const User = mongoose.model("user",userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://secretsappbysaikat.herokuapp.com/auth/google/secrets",
    //userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
    userProfileURL: "https://openidconnect.googleapis.com/v1/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id, username: profile._json.email }, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "https://secretsappbysaikat.herokuapp.com/auth/facebook/secrets",
    enableProof : true
  },
  function(accessToken, refreshToken, profile, done) {
    console.log(profile);
    User.findOrCreate({ facebookId: profile.id, username: profile._json.name }, function (err, user) {
      return done(err, user);
    });
  }
));

app.get("/",function(req,res){
  res.render("home");
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['email'] }));

app.get('/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect secrets page.
    res.redirect('/secrets');
  });

app.get("/auth/facebook", passport.authenticate("facebook",{scope:["email"]}));
app.get('/auth/facebook/secrets',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req,res){
    res.redirect("/secrets");
  });

app.get("/login",function(req,res){
  res.render("login");
});

app.get("/register",function(req,res){
  res.render("register");
});
app.get("/secrets",function(req,res){
  User.find({"__enc_secrets":true}, function(err,foundUsers){
    if(err){
      console.log(err);
    }else{
      if(foundUsers){
        res.render("secrets",{userWithSecrets:foundUsers});
        //console.log(foundUsers);
      }else{
        res.send("No users found.");
      }
    }
  });
});

app.get("/submit",function(req,res){
  if(req.isAuthenticated()){
    res.render("submit");
  }else{
    res.redirect("/login");
  }
});

app.get("/privacy",function(req,res){
  res.render("privacy");
});

app.post("/submit",function(req,res){
  const submittedSecret = req.body.secret;

  User.findOne({username:req.user.username},function(err,foundUser){
    if(err){
      console.log(err);
    }else{
      if(foundUser){
        foundUser.secrets.push(submittedSecret);
        foundUser.save(function(){
          res.redirect("/secrets");
        });
      }
    }
  });
});

app.get("/logout",function(req,res){
  req.logout();
  res.redirect("/");
});

app.post("/register",function(req,res){
  // bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
  //   const newUser = new User({
  //     email : req.body.username,
  //     //password : md5(req.body.password)
  //     password: hash
  //   });
  //   newUser.save(function(err){
  //     if(!err){
  //       res.render("secrets");
  //     }
  //   });
  // });

  //passport
  User.register({username:req.body.username}, req.body.password,function(err,user){
    if(err){
      console.log(err);
      res.redirect("/register");
    }else{
      passport.authenticate("local")(req,res,function(){
        res.redirect("/secrets");
      });
    }
  });
});

app.post("/login",function(req,res){
  // User.findOne({email: req.body.username},function(err,foundUser){
  //   if(foundUser){
  //     bcrypt.compare(req.body.password, foundUser.password, function(err, result) {
  //       if(result){
  //         res.render("secrets");
  //       }
  //     });
  //   }else{
  //     res.send("User does not exist.");
  //   }
  // });

  //passport
  const user = new User({
    username : req.body.username,
    password : req.body.password
  });

  req.login(user, function(err){
    if(err){
      console.log(err);
      res.redirect("/login");
    }else{
      passport.authenticate("local")(req,res,function(){
        res.redirect("/secrets");
      });
    }
  });
});

app.listen(process.env.PORT||3000,function(){
  console.log("Server started on Port 3000");
});
