// Required packages
const express = require('express');
const fetch = require('node-fetch');
const session = require('express-session');  // Import express-session
require('dotenv').config();
const cors = require('cors');

// Create the express server
const app = express();

app.use(cors());

// Set up session middleware
app.use(session({
    secret: 'your-secret-key',  // Change this to a random secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }  // Set to `true` if you're using HTTPS
}));

// Server port number
const port = process.env.PORT || 4000;

// Set the template engine
app.set('view engine', 'ejs');
app.use(express.static("public"));

// Needed to parse HTML data for POST request
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Placeholder for the downloaded songs (can be replaced with a database later)
let downloadedSongs = [];

// Home route ("/")
app.get("/", (req, res) => {
    res.render('index', {
        success: true,
        song_title: '',
        song_link: '',
        playlist: downloadedSongs // Ensure playlist is always passed
    });
});

// Handle the conversion
app.post("/convert-mp3", async (req, res) => {
    const videoId = req.body.videoID;

    if (!videoId) {
        return res.render("index", { 
            success: false, 
            message: "Please enter a video ID", 
            playlist: downloadedSongs  // Pass playlist here
        });
    }

    try {
        const fetchAPI = await fetch(`https://youtube-mp36.p.rapidapi.com/dl?id=${videoId}`, {
            method: "GET",
            headers: {
                "x-rapidapi-key": process.env.API_KEY,
                "x-rapidapi-host": process.env.API_HOST,
            }
        });

        const fetchResponse = await fetchAPI.json();

        if (fetchResponse.status === "ok" && fetchResponse.link) {
            // Save conversion details in the session, but don't add to playlist yet
            req.session.convertedSong = {
                title: fetchResponse.title,
                link: fetchResponse.link,
                downloaded: false  // Initially set downloaded to false
            };

            // Render the page with the download button
            return res.render("index", {
                success: true,
                song_title: fetchResponse.title,
                song_link: fetchResponse.link,
                playlist: downloadedSongs  // Pass updated playlist
            });
        } else {
            return res.render("index", {
                success: false,
                message: fetchResponse.msg || "Failed to convert video to MP3.",
                playlist: downloadedSongs  // Pass playlist even in failure case
            });
        }
    } catch (error) {
        console.error(error);
        return res.render("index", {
            success: false,
            message: "Error converting video to MP3. Please try again.",
            playlist: downloadedSongs  // Ensure playlist is passed even on error
        });
    }
});

// API route to mark the song as downloaded without reloading the page
app.post("/downloaded-ajax", (req, res) => {
    if (req.session.convertedSong) {
        req.session.convertedSong.downloaded = true;
        return res.json({ success: true, message: "Download status updated." });
    }
    return res.json({ success: false, message: "No song found in session." });
});


// Add a route to handle adding the song to the playlist
app.post("/add-to-playlist", (req, res) => {
    // Check if the user has converted and downloaded the song
    if (req.session.convertedSong && req.session.convertedSong.downloaded) {
        const { title, link } = req.session.convertedSong;

        // Check if the song already exists in the playlist
        const songExists = downloadedSongs.some(song => song.title === title);

        if (!songExists) {
            // Add the song to the playlist
            if (title && link) {
                const newSong = {
                    title,
                    link
                };
                downloadedSongs.push(newSong);

                // Clear the session for this song
                req.session.convertedSong = null;
            }

            // Render the homepage again with the updated playlist
            return res.render('index', {
                success: true,
                song_title: '',
                song_link: '',
                message: "Song added to playlist.",
                playlist: downloadedSongs  // Updated playlist with the newly added song
            });
        } else {
            // Song already exists in the playlist
            return res.render('index', {
                success: false,
                message: "Song already exists in the playlist.",
                playlist: downloadedSongs
            });
        }
    } else {
        // If the song was not downloaded, show an error
        return res.render('index', {
            success: false,
            message: "You must download the song before adding it to the playlist.",
            playlist: downloadedSongs
        });
    }
});

// Route to render the playlist page
app.get("/playlist", (req, res) => {
    res.render('playlist', {
        playlist: downloadedSongs // Pass the playlist to the new page
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
