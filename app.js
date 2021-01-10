//Importing
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


//app use
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');


//Creating database
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


//Initializing assport with session
app.use(passport.initialize());
app.use(passport.session());


//Creating Schema
const courseSchema = new mongoose.Schema({
    schoolid: String,
    coursename: String,
    professorid: [],
    studentid: [],
});

const schoolSchema = new mongoose.Schema({
    schoolname: String,
    schoolemail: String,
    adminusername: String,
    shortname: String,
    studentid: [],
    professorid: [],
    courses: [],
});

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    schoolname: String,
    schoolshort: String,
    role: {
        type: String,
        enum: ['professor', 'admin', 'student'],
        default: 'student'
    },
});


//Attach passport to userSchema
userSchema.plugin(passportLocalMongoose);


//Creating Collection
const School = new mongoose.model('School', schoolSchema);
const User = new mongoose.model('User', userSchema);
const Course = new mongoose.model('Course', courseSchema);


//Creating Strategy for Authentication
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


//Routes

//Home route
app.get("/", function(req, res) {
    res.render("homepage");
});


//Register route
app.get("/register", function(req, res) {
    res.render("register", { message: "" });
});

app.post("/register", function(req, res) {
    const schoolname = req.body.schoolname;
    const schoolemail = req.body.schoolemail;
    const username = req.body.username;
    const shortname = req.body.shortname;

    const newSchool = new School({
        schoolname: schoolname,
        schoolemail: schoolemail,
        adminusername: username,
        shortname: shortname
    });

    School.findOne({ schoolemail: schoolemail }, function(err, found) {
        if (found) {
            res.render("register", { message: "School Already Exist with given email" });
        } else {
            newSchool.save(function(err) {
                if (err) {
                    console.log(err);
                }
            });

            User.register({
                username: username,
                schoolname: schoolname,
                role: "admin",
                schoolshort: shortname
            }, req.body.password, function(err, user) {
                if (err) {
                    console.log(err);
                    res.redirect("/register");
                } else {
                    res.redirect("/" + shortname);
                }
            })
        }
    })

});


//Custom School login/logout route
app.get("/:schoolname", function(req, res) {
    const schoolname = req.params.schoolname;

    School.findOne({ shortname: schoolname }, function(err, found) {
        if (!found) {
            res.render("error404");
        } else {
            res.render("login", { school: schoolname, message: "" });
        }
    })
});

app.post("/:schoolname", function(req, res) {
    const username = req.body.username;
    const schoolname = req.params.schoolname;
    const button = req.body.button;

    if (button == "login") {
        User.findOne({ username: username }, function(err, found) {
            if (!found) {
                res.render("login", { school: schoolname, message: "User Not found" })
            } else {
                if (found.schoolshort == schoolname) {
                    const user = new User({
                        username: username,
                        password: req.body.password
                    })
                    req.login(user, function(err) {
                        if (err) {
                            console.log(err);
                            res.render("login", { school: schoolname, message: "Bad Credentials" })
                        } else {
                            passport.authenticate("local", function(err, user, info) {
                                if (info) {
                                    req.session.destroy();
                                    res.render("login", { school: schoolname, message: "Bad Credentials" })
                                } else {
                                    if (found.role === "admin") {
                                        res.redirect("/" + schoolname + "/admin/dashboard");
                                    } else if (found.role === "professor") {
                                        res.redirect("/" + schoolname + "/professor/dashboard");
                                    } else if (found.role === "student") {
                                        res.redirect("/" + schoolname + "/student/dashboard");
                                    }
                                };
                            })(req, res, function() {});
                        }
                    })
                } else {
                    res.render("login", { school: schoolname, message: "User Not found" })
                }
            }
        })
    }
    if (button == "logout") {
        req.logout();
        res.redirect("/" + schoolname);
    }
})


//Admin Dashboard route
app.get("/:schoolname/admin/dashboard", function(req, res) {
    const schoolname = req.params.schoolname;

    if (req.isAuthenticated() && req.user.role == "admin" && req.user.schoolshort == schoolname) {
        School.findOne({ shortname: schoolname }, function(err, find) {
            Course.find({ schoolid: find._id }, function(err, found) {
                res.render("admin_dash", { school: schoolname, courses: found, message: "" });
            })
        })
    } else {
        res.redirect("/" + schoolname);
    }
})

app.post("/:schoolname/admin/dashboard", function(req, res) {
    const schoolname = req.params.schoolname;

    if (req.isAuthenticated() && req.user.role == "admin" && req.user.schoolshort == schoolname) {
        const button = req.body.button;

        if (button == "createcourse") {
            res.redirect("/" + schoolname + "/admin/createcourse");
        }

        if (button == "createprof") {
            res.redirect("/" + schoolname + "/admin/createprof");
        }

        if (button == "createstudent") {
            res.redirect("/" + schoolname + "/admin/createstudent");
        }
    } else {
        res.redirect("/" + schoolname);
    }
})


//Professor Dashboard route
app.get("/:schoolname/professor/dashboard", function(req, res) {
    const schoolname = req.params.schoolname;

    if (req.isAuthenticated() && req.user.role == "professor" && req.user.schoolshort == schoolname) {
        res.render("professor_dash", { school: schoolname })
    } else {
        res.redirect("/" + schoolname);
    }
})


//Student Dashboard Route
app.get("/:schoolname/student/dashboard", function(req, res) {
    const schoolname = req.params.schoolname;

    if (req.isAuthenticated() && req.user.role == "student" && req.user.schoolshort == schoolname) {
        res.render("student_dash", { school: schoolname })
    } else {
        res.redirect("/" + schoolname);
    }
})


//Creating Professor route
app.get("/:schoolname/admin/createprof", function(req, res) {
    const schoolname = req.params.schoolname;

    if (req.isAuthenticated() && req.user.role == "admin" && req.user.schoolshort == schoolname) {
        res.render("create_prof", { school: schoolname, message: "" });
    } else {
        res.redirect("/" + schoolname);
    }
})

app.post("/:schoolname/admin/createprof", function(req, res) {
    const link = req.params.schoolname;

    if (req.isAuthenticated() && req.user.role == "admin" && req.user.schoolshort == link) {
        const schoolname = req.user.schoolname;
        const username = req.body.username;

        User.findOne({ username: username }, function(err, found) {
            if (found) {
                res.render("create_prof", { school: link, message: "professor Already Exist" })
            } else {
                User.register({
                    username: username,
                    schoolname: schoolname,
                    role: "professor",
                    schoolshort: link,
                }, req.body.password, function(err, user) {
                    if (err) {
                        console.log(err);
                        res.redirect("/" + link);
                    } else {
                        User.findOne({ username: username }, function(err, find) {
                            School.findOne({ shortname: link }, function(err, founded) {
                                if (founded) {
                                    founded.professorid.push(find._id)
                                    founded.save(function() {
                                        res.redirect("/" + link + "/admin/dashboard");
                                    });
                                }
                            })
                        })
                    }
                })
            }
        })

    } else {
        res.redirect("/" + link);
    }
})


//Creating Student route
app.get("/:schoolname/admin/createstudent", function(req, res) {
    const schoolname = req.params.schoolname;

    if (req.isAuthenticated() && req.user.role == "admin" && req.user.schoolshort == schoolname) {
        res.render("create_student", { school: schoolname, message: "" });
    } else {
        res.redirect("/" + schoolname);
    }
})

app.post("/:schoolname/admin/createstudent", function(req, res) {
    const link = req.params.schoolname;

    if (req.isAuthenticated() && req.user.role == "admin" && req.user.schoolshort == link) {
        const schoolname = req.user.schoolname;
        const username = req.body.username;

        User.findOne({ username: username }, function(err, found) {
            if (found) {
                res.render("create_student", { school: link, message: "student Already Exist" })
            } else {
                User.register({
                    username: username,
                    schoolname: schoolname,
                    role: "student",
                    schoolshort: link,
                }, req.body.password, function(err, user) {
                    if (err) {
                        console.log(err);
                        res.redirect("/" + link);
                    } else {
                        User.findOne({ username: username }, function(err, find) {
                            School.findOne({ shortname: link }, function(err, founded) {
                                if (founded) {
                                    founded.studentid.push(find._id)
                                    founded.save(function() {
                                        res.redirect("/" + link + "/admin/dashboard");
                                    });
                                }
                            })
                        })
                    }
                })
            }
        })

    } else {
        res.redirect("/" + link);
    }
})


//Creating course route
app.get("/:schoolname/admin/createcourse", function(req, res) {
    const schoolname = req.params.schoolname;

    if (req.isAuthenticated() && req.user.role == "admin" && req.user.schoolshort == schoolname) {
        res.render("create_course", { school: schoolname, message: "" });
    } else {
        res.redirect("/" + schoolname);
    }
})

app.post("/:schoolname/admin/createcourse", function(req, res) {
    const schoolname = req.params.schoolname;

    if (req.isAuthenticated() && req.user.role == "admin" && req.user.schoolshort == schoolname) {
        const coursename = req.body.coursename;

        School.findOne({ shortname: schoolname }, function(err, find) {

            const newCourse = new Course({
                coursename: coursename,
                schoolid: find._id,
            });

            Course.findOne({
                schoolid: find._id,
                coursename: coursename
            }, function(err, found) {

                if (found) {
                    res.render("create_course", {
                        school: schoolname,
                        message: "Course Already Exist"
                    });
                } else {
                    newCourse.save(function() {
                        Course.findOne({ schoolid: find._id, coursename: coursename }, function(err, founded) {
                            find.courses.push(founded._id)
                            find.save(function() {
                                res.redirect('/' + schoolname + "/admin/dashboard");
                            })
                        });
                    })
                }
            })
        })

    } else {
        res.redirect("/" + schoolname);
    }
})


//Custom Course route
app.get("/:schoolname/admin/courses/:coursename", function(req, res) {
    const schoolname = req.params.schoolname;

    if (req.isAuthenticated() && req.user.role == "admin" && req.user.schoolshort == schoolname) {
        const coursename = req.params.coursename;

        School.findOne({ shortname: schoolname }, function(err, find) {
            Course.findOne({ coursename: coursename, schoolid: find._id }, function(err, found) {
                if (found) {
                    var professorid;
                    var studentid;

                    if (found.professorid) professorid = found.professorid;
                    if (found.studentid) studentid = found.studentid;

                    var allids = professorid.concat(studentid);

                    User.find({ _id: { $in: allids } }, function(err, founded) {
                        var professors = [];
                        var students = [];


                        for (var i = 0; i < founded.length; i++) {
                            if (founded[i].role == "student") students.push(founded[i].username);
                            if (founded[i].role == "professor") professors.push(founded[i].username);
                        }
                        res.render("course", {
                            school: schoolname,
                            coursename: coursename,
                            message: "",
                            professors: professors,
                            students: students,
                        });
                    })
                } else {
                    res.render("error404");
                }
            })
        })
    } else {
        res.redirect("/" + schoolname);
    }
})

app.post("/:schoolname/admin/courses/:coursename", function(req, res) {
    const schoolname = req.params.schoolname;
    const coursename = req.params.coursename;

    if (req.isAuthenticated() && req.user.role == "admin" && req.user.schoolshort == schoolname) {
        const button = req.body.button;

        if (button == "enrollstudent") {
            res.redirect("/" + schoolname + "/admin/courses/" + coursename + "/enrollstudent");
        }
        if (button == "assignprof") {
            res.redirect("/" + schoolname + "/admin/courses/" + coursename + "/assignprof");
        }
    } else {
        res.redirect("/" + schoolname);
    }
})


//Assigning Professor route
app.get("/:schoolname/admin/courses/:coursename/assignprof", function(req, res) {
    const schoolname = req.params.schoolname;
    const coursename = req.params.coursename;

    if (req.isAuthenticated() && req.user.role == "admin" && req.user.schoolshort == schoolname) {
        School.findOne({ shortname: schoolname }, function(err, found) {

            Course.findOne({ coursename: coursename, schoolid: found._id }, function(err, find) {
                if (find) {
                    var a = found.professorid;
                    var b = find.professorid;

                    var professorsid = a.filter(x => !b.includes(x));

                    User.find({ _id: { $in: professorsid } }, function(err, founded) {
                        var professors = []
                        for (var i = 0; i < founded.length; i++) {
                            professors.push(founded[i]);
                        }

                        res.render("assign_prof", {
                            school: schoolname,
                            coursename: coursename,
                            professors: professors,
                            message: ""
                        });
                    })

                } else {
                    res.render("error404");
                }
            })
        })

    } else {
        res.redirect("/" + schoolname);
    }
})

app.post("/:schoolname/admin/courses/:coursename/assignprof", function(req, res) {
    const schoolname = req.params.schoolname;
    const coursename = req.params.coursename;

    if (req.isAuthenticated() && req.user.role == "admin" && req.user.schoolshort == schoolname) {
        var professors = req.body.profname;

        if (typeof professors == "string") {
            professors = [];
            professors.push(req.body.profname)
        }
        School.findOne({ shortname: schoolname }, function(err, find) {
            Course.findOne({ coursename: coursename, schoolid: find._id }, function(err, found) {

                for (var i = 0; i < professors.length; i++) {
                    found.professorid.push(professors[i]);
                }
                found.save(function() {
                    res.redirect("/" + schoolname + "/admin/courses/" + coursename);
                })
            })
        })
    } else {
        res.redirect("/" + schoolname);
    }
})


//Enrolling Student route
app.get("/:schoolname/admin/courses/:coursename/enrollstudent", function(req, res) {
    const schoolname = req.params.schoolname;
    const coursename = req.params.coursename;

    if (req.isAuthenticated() && req.user.role == "admin" && req.user.schoolshort == schoolname) {
        School.findOne({ shortname: schoolname }, function(err, found) {

            Course.findOne({ coursename: coursename, schoolid: found._id }, function(err, find) {
                if (find) {
                    var a = found.studentid;
                    var b = find.studentid;

                    var studentid = a.filter(x => !b.includes(x));

                    User.find({ _id: { $in: studentid } }, function(err, founded) {
                        var students = []
                        for (var i = 0; i < founded.length; i++) {
                            students.push(founded[i]);
                        }

                        res.render("enroll_student", {
                            school: schoolname,
                            coursename: coursename,
                            students: students,
                            message: ""
                        });
                    })

                } else {
                    res.render("error404");
                }
            })
        })

    } else {
        res.redirect("/" + schoolname);
    }
})

app.post("/:schoolname/admin/courses/:coursename/enrollstudent", function(req, res) {
    const schoolname = req.params.schoolname;
    const coursename = req.params.coursename;

    if (req.isAuthenticated() && req.user.role == "admin" && req.user.schoolshort == schoolname) {
        var students = req.body.studentname;

        if (typeof students == "string") {
            students = [];
            students.push(req.body.studentname)
        }
        School.findOne({ shortname: schoolname }, function(err, find) {
            Course.findOne({ coursename: coursename, schoolid: find._id }, function(err, found) {

                for (var i = 0; i < students.length; i++) {
                    found.studentid.push(students[i]);
                }
                found.save(function() {
                    res.redirect("/" + schoolname + "/admin/courses/" + coursename);
                })
            })
        })
    } else {
        res.redirect("/" + schoolname);
    }
})


// Server Hosting
app.listen(3000, function() {
    console.log("server started");
})