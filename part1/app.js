var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var mysql = require("mysql2/promise");

var app = express();

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
let db;
(async () => {
  try {
    db = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "",
      database: "DogWalkService"
    });
    const [userCount] = await db.execute("SELECT COUNT(*) as count FROM Users");
    if (userCount[0].count === 0) {
      await db.execute(`INSERT INTO Users (username, email, password_hash, role) VALUES
        ('alice123', 'alice@example.com', 'hashed123', 'owner'),
        ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
        ('carol123', 'carol@example.com', 'hashed789', 'owner'),
        ('davidwalker', 'david@example.com', 'hashed101', 'walker'),
        ('emma123', 'emma@example.com', 'hashed202', 'owner')`);
      await db.execute(`INSERT INTO Dogs (owner_id, name, size) VALUES
        ((SELECT user_id FROM Users WHERE username = 'alice123'), 'Max', 'medium'),
        ((SELECT user_id FROM Users WHERE username = 'carol123'), 'Bella', 'small'),
        ((SELECT user_id FROM Users WHERE username = 'alice123'), 'Buddy', 'large'),
        ((SELECT user_id FROM Users WHERE username = 'emma123'), 'Luna', 'small'),
        ((SELECT user_id FROM Users WHERE username = 'carol123'), 'Rocky', 'medium')`);
      await db.execute(`INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status) VALUES
        ((SELECT dog_id FROM Dogs WHERE name = 'Max' AND owner_id = (SELECT user_id FROM Users WHERE username = 'alice123')), '2025-06-10 08:00:00', 30, 'Parklands', 'open'),
        ((SELECT dog_id FROM Dogs WHERE name = 'Bella' AND owner_id = (SELECT user_id FROM Users WHERE username = 'carol123')), '2025-06-10 09:30:00', 45, 'Beachside Ave', 'accepted'),
        ((SELECT dog_id FROM Dogs WHERE name = 'Buddy' AND owner_id = (SELECT user_id FROM Users WHERE username = 'alice123')), '2025-06-11 14:00:00', 60, 'Central Park', 'open'),
        ((SELECT dog_id FROM Dogs WHERE name = 'Luna' AND owner_id = (SELECT user_id FROM Users WHERE username = 'emma123')), '2025-06-12 10:00:00', 30, 'Riverside Walk', 'completed'),
        ((SELECT dog_id FROM Dogs WHERE name = 'Rocky' AND owner_id = (SELECT user_id FROM Users WHERE username = 'carol123')), '2025-06-13 16:00:00', 45, 'Hilltop Trail', 'open')`);
      await db.execute(`INSERT INTO WalkApplications (request_id, walker_id, status) VALUES
        ((SELECT request_id FROM WalkRequests WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name = 'Bella') AND status = 'accepted'), (SELECT user_id FROM Users WHERE username = 'bobwalker'), 'accepted'),
        ((SELECT request_id FROM WalkRequests WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name = 'Luna') AND status = 'completed'), (SELECT user_id FROM Users WHERE username = 'davidwalker'), 'accepted')`);
      await db.execute(`INSERT INTO WalkRatings (request_id, walker_id, owner_id, rating, comments) VALUES
        ((SELECT request_id FROM WalkRequests WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name = 'Luna') AND status = 'completed'), (SELECT user_id FROM Users WHERE username = 'davidwalker'), (SELECT user_id FROM Users WHERE username = 'emma123'), 5, 'Excellent walk!'),
        ((SELECT request_id FROM WalkRequests WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name = 'Bella') AND status = 'accepted'), (SELECT user_id FROM Users WHERE username = 'bobwalker'), (SELECT user_id FROM Users WHERE username = 'carol123'), 4, 'Great service')`);
    }
  } catch (error) {
    console.error("Database connection failed:", error);
  }
})();
app.locals.db = db;



// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
});
app.get("/api/dogs", async (req, res) => {
  try {
    const [dogs] = await db.execute(`
      SELECT d.name as dog_name, d.size, u.username as owner_username
      FROM Dogs d JOIN Users u ON d.owner_id = u.user_id`);
    res.json(dogs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch dogs" });
  }
});
app.get("/api/walkrequests/open", async (req, res) => {
  try {
    const [requests] = await db.execute(`
      SELECT wr.request_id, d.name as dog_name, wr.requested_time,
             wr.duration_minutes, wr.location, u.username as owner_username
      FROM WalkRequests wr
      JOIN Dogs d ON wr.dog_id = d.dog_id
      JOIN Users u ON d.owner_id = u.user_id
      WHERE wr.status = 'open'`);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch open walk requests" });
  }
});
app.get("/api/walkers/summary", async (req, res) => {
  try {
    const [summary] = await db.execute(`
SELECT
    u.username as walker_username,
    IFNULL(r.total_ratings, 0) as total_ratings,
    ROUND(AVG(rating), 1) as average_rating,
    IFNULL(c.completed_walks, 0) as completed_walks
FROM Users as u
LEFT JOIN (
    SELECT
        walker_id,
        COUNT(*) as total_ratings,
        AVG(rating) as average_rating
    FROM WalkRatings
    GROUP BY walker_id
) as r  ON r.walker_id = u.user_id
LEFT JOIN (
    SELECT
        wa.walker_id,
        COUNT(*) as completed_walks
    FROM WalkApplications as wa
    JOIN WalkRequests as wr ON wr.request_id = wa.request_id
    WHERE wa.status = 'accepted'
      AND wr.status = 'completed'
    GROUP BY wa.walker_id
) as c  ON c.walker_id = u.user_id
WHERE u.role = 'walker';
    `);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch walker summary" });
  }
});

module.exports = app;
