require('dotenv').config()
const express = require('express');
const mongoose = require('mongoose');
const _ = require('lodash');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');


//express app
const app = express();


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');


//creating database
const db = mongoose.connect('mongodb://localhost:27017/schudle', { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);


//Session prperties
app.use(session({
    secret: process.env.SECRETKEY,
    resave: false,
    saveUninitialized: true
}));


//Initializing passport with session
app.use(passport.initialize());
app.use(passport.session());


// creating schema
const schoolSchema = new mongoose.Schema({
    schoolName: String,
    schoolemail: String,
    adminUsername: String,
    shortname: String, 
});

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    schoolName: String,
    schoolshort: String,
    role: {
        type: String,
        enum : ['professor','admin','student'],
        default: 'student'
    },
});

// const professorSchema = new mongoose.Schema({
//     username: String,
//     password: String,
//     schoolName: String
// });

// const studentSchema = new mongoose.Schema({
//     username: String,
//     password: String,
//     schoolName: String
// });

userSchema.plugin(passportLocalMongoose);

const School = new mongoose.model('School', schoolSchema);
const User = new mongoose.model('User', userSchema);
// const Professor = new mongoose.model('Professor', professorSchema);
// const Student = new mongoose.model('Student', studentSchema);



//Creating Strategy for Authentication
passport.use(User.createStrategy());


passport.serializeUser(User.serializeUser());


passport.deserializeUser(User.deserializeUser());




// getrequests

app.get("/", function(req,res){
    res.render("homepage");
});


app.get("/register",function(req,res){
    res.render("register");
});

app.post("/register",function(req,res){
    console.log(req.body);
    const link = req.body.shortname;
    const newSchool = new School({
        schoolName: req.body.schoolname,
        schoolemail: req.body.schoolemail,
        adminUsername: req.body.username,
        shortname: req.body.shortname
    });
    newSchool.save(function(err){
        if(err){
            console.log(err);
        }
    });

    User.register({username: req.body.username, schoolName:req.body.schoolname, role: "admin", schoolshort:req.body.shortname},req.body.password, function(err,user){
        if(err){
            console.log(err);
            res.redirect("/register");
        }else{
            res.redirect("/"+link);
        }
    })
});

app.get("/:schoolname",function(req,res){
    School.findOne({shortname: req.params.schoolname},function(err,found){
        if(!found){
            console.log("not found");
            res.render("error404");
            
        }
        else{
            res.render("login",{school : req.params.schoolname, message: ""});
        }
    })
});

app.post("/:schoolname/login",function(req,res){
    User.findOne({username: req.body.username}, function(err,found){
        if(!found){
            res.render("login",{school:req.params.schoolname, message: "User Not found"})
        }
        else{
            if(found.schoolshort == req.params.schoolname){
                const user = new User({
                    username : req.body.username,
                    password: req.body.password
                })
                
                req.login(user, function(err){
                    if(err){
                        console.log(err);
                        res.render("login",{school:req.params.schoolname, message: "Bad Credentials"})
                    }else{
                        // passport.authenticate("local")(req,res,function(){
                        //     if(found.role === "admin"){
                        //         res.redirect("/"+req.params.schoolname+"/admin/dashboard");
                        //     }
                        //     else if(found.role === "professor"){
                        //         res.redirect("/"+req.params.schoolname+"/professor/dashboard");
                        //     }
                        //     else if(found.role === "student"){
                        //         res.redirect("/"+req.params.schoolname+"/student/dashboard");
                        //     }
                        // })
                        passport.authenticate("local", function(err, user, info) {
                            if (info) {
                                req.session.destroy();
                                res.render("login", { school:req.params.schoolname, message: "Bad Credentials"})
                            } else(res.redirect("/"));
                        })(req, res, function() {});
                    }
                })
            }
            else{
                res.render("login",{school:req.params.schoolname, message: "User Not found"})
            }
        }
    })
})

app.get("/:schoolname/logout",function(req,res){
    req.logout();
    res.redirect("/"+req.params.schoolname);
})

app.get("/:schoolname/admin/dashboard",function(req,res){
    if(req.isAuthenticated()){
        res.render("admin_dash",{school: req.params.schoolname})
    }
    else{
        res.redirect("/"+req.params.schoolname);
    }
})

app.get("/:schoolname/professor/dashboard",function(req,res){
    if(req.isAuthenticated()){
        res.render("professor_dash",{school: req.params.schoolname})
    }
    else{
        res.redirect("/"+req.params.schoolname);
    }
})

app.get("/:schoolname/student/dashboard",function(req,res){
    if(req.isAuthenticated()){
        res.render("student_dash",{school: req.params.schoolname})
    }
    else{
        res.redirect("/"+req.params.schoolname);
    }
})


// Server Hosting
app.listen(3000, function() {
    console.log("server started");
})