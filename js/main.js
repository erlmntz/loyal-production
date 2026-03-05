// Initialize TypeIt for the typewriter effect
document.addEventListener('DOMContentLoaded', function() {
    new TypeIt("#typewriter-text", {
        strings: ["\"We capture life's most precious moments with creativity and professionalism. Whether it's a wedding, debut, or private party, our team ensures every shot tells your story.\""],
        speed: 20,
        waitUntilVisible: true,
        cursor: true,
        cursorChar: '|',
        startDelay: 500,
        nextStringDelay: 5000,
        loop: true,
        loopDelay: 10000 
    }).go();
    
    });