require('dotenv').config();
const express = require("express");
const ejs = require("ejs");
const port = 3000;
const mongoose = require("mongoose");
// const md5 = require('md5');
// const bcrypt = require('bcrypt');
// const saltRounds = 10;
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth2').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const findOrCreate = require('mongoose-findorcreate')



const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
mongoose.set('useCreateIndex', true);
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());


mongoose.connect("mongodb://localhost:27017/userDB", { useNewUrlParser: true, useUnifiedTopology: true });


const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    facebookId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);


const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
        done(err, user)
    })
})

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    passReqToCallback: true
},
    function (request, accessToken, refreshToken, profile, done) {
        console.log(profile);
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
            return done(err, user);
        });
    }
));

passport.use(new FacebookStrategy({
    clientID: process.env.APP_ID,
    clientSecret: process.env.APP_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets"
},
    function (accessToken, refreshToken, profile, cb) {
        User.findOrCreate({ facebookId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));

app.get("/", (req, res) => {
    res.render("home")
});

app.get("/auth/google", passport.authenticate("google", { scope: ["profile"] }));

app.get('/auth/google/secrets',
    passport.authenticate('google', {
        successRedirect: '/secrets',
        failureRedirect: '/login'
    }));

app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['public_profile', 'email'] }));

app.get('/auth/facebook/secrets',
    passport.authenticate('facebook', {
        successRedirect: '/secrets',
        failureRedirect: '/login'
    }));

app.get("/login", (req, res) => {
    res.render("login")
});

app.get("/register", (req, res) => {
    res.render("register")
});

app.get('/secrets', (req, res) => {
    User.find({ 'secret': { $ne: null } }, (err, foundUsers) => {
        if (!err) {
            if (foundUsers) {
                res.render("secrets", {usersWithSecrets: foundUsers});
            }
        }
    });
});

app.get('/submit', (req, res) => {
    if (req.isAuthenticated()) {
        res.render('submit');
    } else {
        res.redirect('/login');
    }
});

app.post('/submit', (req, res) => {
    const submittedSecret = req.body.secret;

    console.log(req.user.id);

    User.findById(req.user.id, (err, foundUser) => {
        if (!err) {
            if (foundUser) {
                foundUser.secret = submittedSecret;
                foundUser.save(() => res.redirect('/secrets'));
            }
        } else {
            console.log(err);
        }
    })
})

app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/');
});



app.post("/register", (req, res) => {

    User.register({ username: req.body.username }, req.body.password, (err, user) => {
        if (!err) {
            passport.authenticate("local")(req, res, () => res.redirect('/secrets'))
        } else {
            console.log(err);
            res.redirect('/register')
        }
    });



    // bcrypt.genSalt(saltRounds, function (err, salt) {
    //     bcrypt.hash(req.body.password, salt, function (err, hash) {
    //         // Store hash in your password DB.
    //         const newUser = new User({
    //             email: req.body.username,
    //             password: hash
    //         });
    //         newUser.save((err) => {
    //             if (err) {
    //                 console.log(err);
    //             } else {
    //                 res.render("secrets");
    //             }
    //         });
    //     });
    // });
});

app.post("/login", (req, res) => {

    const user = new User({
        username: req.body.username,
        password: req.body.password
    })

    req.login(user, (err) => {
        if (!err) {
            passport.authenticate('local')(req, res, () => res.redirect('/secrets'))
        } else {
            console.log(err);
        }
    })






















    // const username = req.body.username;
    // const password = req.body.password;

    // User.findOne({ email: username }, (err, success) => {
    //     if (!err) {
    //         if (success) {
    //             bcrypt.compare(password, success.password, (err, result) => {
    //                 if (result === true) {
    //                     res.render('secrets')
    //                 }
    //             });
    //         }
    //     } else {
    //         console.log(err);
    //     }
    // });

});





app.listen(port, () => {
    console.log(`Server started on port number: ${port}`);
});
