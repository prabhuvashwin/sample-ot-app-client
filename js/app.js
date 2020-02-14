let archiveId;
let sessionId;
let role;
let name = 'Unnamed';
let publisher;

const handleError = error => {
  if ( error ) {
    console.error( error );
  }
};

const onSubmit = () => {
  const roleInput = document.querySelector( '#role' );
  role = roleInput.value;
  name = document.querySelector( '#name' ).value || 'Unnamed';

  const login = document.querySelector( '.login-container' );
  login.classList.add( 'hide' );
  const home = document.querySelector( '.home-container' );
  home.classList.remove( 'hide' );
  // Run init()
  init();
}

const setupTextChat = session => {
  // =============== Setup text chat ===============
  const form = document.querySelector( 'form' );
  const msgTxt = document.querySelector( '#msgTxt' );

  // Send a signal once the user enters data in the form
  form.addEventListener( 'submit', event => {
    event.preventDefault();

    session && session.signal( {
      type: 'msg',
      data: `>>>${name}: ${msgTxt.value}`
    }, error => {
      if ( error ) {
        console.error( `Error sending signal: ${error.name}, ${error.message}` );
      } else {
        msgTxt.value = '';
      }
    } );
  } );
  // =============== Setup text chat ===============
}

updateStreams = session => {
  const connectionList = document.querySelector( '#connectionList' );
  session.on( 'connectionCreated', event => {
    const { connections } = event;
    const conn = document.createElement( 'span' );
    conn.textContent = `${connections[0].data} joined`;
    conn.className = 'connEle';
    connectionList.appendChild( conn );
    conn.scrollIntoView();
  } );

  session.on( 'connectionDestroyed', event => {
    const { connections } = event;
    const conn = document.createElement( 'span' );
    conn.textContent = `${connections[0].data} left`;
    conn.className = 'connEle';
    connectionList.appendChild( conn );
    conn.scrollIntoView();
  } );
}

const init = () => {

  // Set initial states for archiving buttons
  document.querySelector( '#start' ).disabled = false;
  document.querySelector( '#view' ).disabled = true;
  document.querySelector( '#stop' ).disabled = true;
  archiveId = null;

  // Get apiKey, sessionId, token info and initialize session
  if ( SAMPLE_SERVER_BASE_URL ) {
    fetch( `${SAMPLE_SERVER_BASE_URL}/session/${name}` )
      .then( res => res.json() )
      .then( json => {
        const { apiKey, sessionId: _sessionId, token } = json;

        if ( !apiKey || !_sessionId && !token ) return;

        sessionId = _sessionId;

        const session = OT.initSession( apiKey, sessionId );

        setupTextChat( session );

        updateStreams( session );
        setupFeatures( { session, token } );
      } ).catch( error => {
        handleError(error);
        alert('Failed to get opentok sessionId and token. Make sure you have updated the config.js file.');
      }
    );
  }
}

// Setup subscribers, publishers, archiving, signaling
const setupFeatures = ( args = {} ) => {
  const { session, token } = args;

  const layoutContainer = document.getElementById( 'layout' );

  const options = {
    maxRatio: 3/2,             // The narrowest ratio that will be used (default 2x3)
    minRatio: 9/16,            // The widest ratio that will be used (default 16x9)
    fixedRatio: false,         // If this is true then the aspect ratio of the video is maintained and minRatio and maxRatio are ignored (default false)
    // alignItems: 'start',      // Can be 'start', 'center' or 'end'. Determines where to place items when on a row or column that is not full
    // bigClass: "OT_big",        // The class to add to elements that should be sized bigger
    // bigPercentage: 0.8,        // The maximum percentage of space the big ones should take up
    // bigFixedRatio: false,      // fixedRatio for the big ones
    // bigAlignItems: 'center',   // How to align the big items
    // smallAlignItems: 'center', // How to align the small row or column of items if there is a big one
    bigMaxRatio: 3/2,          // The narrowest ratio to use for the big elements (default 2x3)
    bigMinRatio: 9/16,         // The widest ratio to use for the big elements (default 16x9)
    bigFirst: true,            // Whether to place the big one in the top left (true) or bottom right
    animate: true,             // Whether you want to animate the transitions
    animateDuration: 200,
    animateEasing: "swing",
    window: window,            // Lets you pass in your own window object which should be the same window that the element is in
    // ignoreClass: 'OT_ignore',  // Elements with this class will be ignored and not positioned. This lets you do things like picture-in-picture
  };

  // Initialize the layout container and get a reference to the layout method
  const { layout } = initLayoutContainer( layoutContainer, options );

  // Subscribe to a newly created stream
  session.on( 'streamCreated', event => {
    const subscriberOptions = {
      insertMode: 'append',
      width: '100%',
      height: '100%'
    };
    session.subscribe( event.stream, 'subscriber', subscriberOptions, handleError );
    layout();
  } );

  // Start the archive
  session.on( 'archiveStarted', event => {
    archiveId = event.id;
    console.log( `Archive started: ${archiveId}` );
    document.querySelector( '#stop' ).disabled = false;
    document.querySelector( '#start' ).disabled = true;
    document.querySelector( '#view' ).disabled = true;
  } );

  // Stop the archive
  session.on( 'archiveStopped', event => {
    archiveId = event.id;
    console.log( `Archive stopped: ${archiveId}` );
    document.querySelector( '#start' ).disabled = false;
    document.querySelector( '#stop' ).disabled = true;
    document.querySelector( '#view' ).disabled = false;
  } );

  session.on( 'sessionDisconnected', event => {
    console.log( `You were disconnected from the session: ${event.reason}` );
  } );

  if ( role !== 'Viewer' ) {
    // initialize the publisher
    const publisherOptions = {
      insertMode: 'append',
      width: '100%',
      height: '100%',
      mirror: true,
      name,
    };
    const p = document.querySelector( '#publisher' );
    p.classList.remove( 'hide' );
    publisher = OT.initPublisher( 'publisher', publisherOptions, handleError );
    window.__publisher = publisher;
    // Connect to the session
    session.connect( token, error => {
      if ( error ) {
        handleError( error );
      } else {
        // If the connection is successful, publish the publisher to the session
        session.publish( publisher, handleError );
        layout();
      }
    } );
  }
  else {
    document.querySelector( '#pShow' ).disabled = true;
    document.querySelector( '#pHide' ).disabled = true;
    document.querySelector( '#startVideo' ).disabled = true;
    document.querySelector( '#stopVideo' ).disabled = true;
    document.querySelector( '#startAudio' ).disabled = true;
    document.querySelector( '#stopAudio' ).disabled = true;
    // Connect to the session
    session.connect( token, error => {
      if ( error ) {
        handleError( error );
      } else {
        // If the connection is successful, publish the publisher to the session
        layout();
      }
    } );
  }

  // Receive a message and append it to the history
  const msgHistory = document.querySelector( '#history' );
  session.on( 'signal:msg', event => {
    const msg = document.createElement( 'li' );
    msg.textContent = `${event.data}`;
    msg.className = event.from.connectionId === session.connection.connectionId ? 'mine' : 'theirs';
    msgHistory.appendChild( msg );
    msg.scrollIntoView();
  } );
}

// Start recording
const startArchive = () => {
  fetch( `${SAMPLE_SERVER_BASE_URL}/archive/start`, {
    method: 'POST',
    mode: 'cors',
    cache: 'no-cache',
    headers: {
      'Content-Type': 'application/json',
    },
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
    body: JSON.stringify( { sessionId } ),
  } ).then( response => {
    console.log( `startArchive() complete - response: ${response}` );
    return response.json();
  } ).then( data => {
    console.log( `Successfully started archive - data returned: ${data}` );
  } ).catch( err => {
    console.log( `Error calling startArchive - message: ${err}` );
  } );

  document.querySelector( '#start' ).disabled = true;
  document.querySelector( '#stop' ).disabled = false;
  document.querySelector( '#view' ).disabled = true;
}

// Stop recording
const stopArchive = () => {
  fetch( `${SAMPLE_SERVER_BASE_URL}/archive/${archiveId}/stop`, {
    method: 'POST',
    mode: 'cors',
    cache: 'no-cache',
    headers: {
      'Content-Type': 'application/json',
    },
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
    body: JSON.stringify( {} ),
  } ).then( response => {
    console.log( `stopArchive() complete - response: ${response}` );
    return response.json();
  } ).then( data => {
    console.log( `Successfully stopped archive - data returned: ${data}` );
  } ).catch( err => {
    console.log( `Error calling stopArchive - message: ${err}` );
  } );
  document.querySelector( '#stop' ).disabled = true;
  document.querySelector( '#view' ).disabled = false;
  document.querySelector( '#start' ).disabled = false;
}

// Get the archive status. If it is  "available", download it. Otherwise, keep checking
// every 5 secs until it is "available"
const viewArchive = () => {
  document.querySelector( '#view' ).disabled = true;
  window.location = `${SAMPLE_SERVER_BASE_URL}/archive/${archiveId}/view`;
}

const startBroadcast = () => {
  stopArchive();
  document.querySelector( '#view' ).disabled = true;

  document.querySelector( '#bStart' ).disabled = true;
  document.querySelector( '#bStop' ).disabled = false;
}

const stopBroadcast = () => {
  document.querySelector( '#bStart' ).disabled = false;
  document.querySelector( '#bStop' ).disabled = true;
}

const showPublisher = () => {
  document.querySelector( '#pShow' ).disabled = true;
  document.querySelector( '#pHide' ).disabled = false;
  document.querySelector( '#publisher' ).classList.remove( 'hide' );
}

const hidePublisher = () => {
  document.querySelector( '#pShow' ).disabled = false;
  document.querySelector( '#pHide' ).disabled = true;
  document.querySelector( '#publisher' ).classList.add( 'hide' );
}

const startPublishingVideo = () => {
  document.querySelector( '#startVideo' ).disabled = true;
  document.querySelector( '#stopVideo' ).disabled = false;

  publisher.publishVideo( true );
}

const stopPublishingVideo = () => {
  document.querySelector( '#startVideo' ).disabled = false;
  document.querySelector( '#stopVideo' ).disabled = true;

  publisher.publishVideo( false );
}

const startPublishingAudio = () => {
  document.querySelector( '#startAudio' ).disabled = true;
  document.querySelector( '#stopAudio' ).disabled = false;

  publisher.publishAudio( true );
}

const stopPublishingAudio = () => {
  document.querySelector( '#startAudio' ).disabled = false;
  document.querySelector( '#stopAudio' ).disabled = true;

  publisher.publishAudio( false );
}