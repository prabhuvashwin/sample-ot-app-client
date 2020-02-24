let archiveId;
let archiveStatus = false;
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
  login.style.display = "none";
  if ( role === 'Broadcast Viewer' ) {
    const broadcast = document.querySelector( '.broadcast-container' );
    broadcast.classList.remove( 'hide' );
  } else {
    const home = document.querySelector( '.home-container' );
    home.classList.remove( 'hide' );
  }

  init( role );
}

const setupTextChat = session => {
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
}

changeBroadcastStatus = cb => {
  fetch( `${SAMPLE_SERVER_BASE_URL}/broadcast/id` )
    .then( res => res.json() )
    .then( json => {
      cb && cb( json );
    } )
    .catch( error => {
      handleError(error);
      alert('Failed to get broadcast id');
    } );
}

updateStreams = ( session, layout ) => {
  const connectionList = document.querySelector( '#connectionList' );
  // Receive a message and append it to the connectionList
  session.on( 'signal:broadcast', event => {
    const conn = document.createElement( 'span' );
    conn.textContent = `${event.data}`;
    conn.className = 'connEle';
    connectionList.appendChild( conn );
    conn.scrollIntoView();
  } );

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
    archiveStatus = true;
    console.log( `Archive started: ${archiveId}` );
    document.querySelector( '#stop' ).disabled = false;
    document.querySelector( '#start' ).disabled = true;
    document.querySelector( '#view' ).disabled = true;
    const conn = document.createElement( 'span' );
    conn.textContent = `Archive started with id: ${archiveId}`;
    conn.className = 'connEle';
    connectionList.appendChild( conn );
    conn.scrollIntoView();
  } );

  // Stop the archive
  session.on( 'archiveStopped', event => {
    archiveId = event.id;
    archiveStatus = false;
    console.log( `Archive stopped: ${archiveId}` );
    document.querySelector( '#start' ).disabled = false;
    document.querySelector( '#stop' ).disabled = true;
    document.querySelector( '#view' ).disabled = false;
    const conn = document.createElement( 'span' );
    conn.textContent = `Archive stopped with id: ${archiveId}`;
    conn.className = 'connEle';
    connectionList.appendChild( conn );
    conn.scrollIntoView();
  } );

  session.on( 'sessionDisconnected', event => {
    console.log( `You were disconnected from the session: ${event.reason}` );
    const conn = document.createElement( 'span' );
    conn.textContent = `${name} disconnected from the session`;
    conn.className = 'connEle';
    connectionList.appendChild( conn );
    conn.scrollIntoView();
  } );

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

const init = role => {

  if ( role === "Broadcast Viewer" ) {
    if ( SAMPLE_SERVER_BASE_URL ) {
      fetch( `${SAMPLE_SERVER_BASE_URL}/broadcast/id` )
        .then( res => res.json() )
        .then( json => {
          const { broadcastId } = json;

          fetch( `${SAMPLE_SERVER_BASE_URL}/broadcast/${broadcastId}/view` )
            .then( res => res.json() )
            .then( json => {
              const banner = document.querySelector( '#banner' );
              banner.style.display = "none";

              const videoSrc = document.querySelector( '#videoSrc' );
              videoSrc.src = json.broadcastUrls.hls;

              const ply = videojs( "video" );
              ply.play();
            } )
        } ).catch( error => {
          handleError(error);
          alert('Failed to get broadcast id');
        }
      );
    }
  } else {
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

          setupFeatures( { session, token } );
        } ).catch( error => {
          handleError(error);
          alert('Failed to get opentok sessionId and token. Make sure you have updated the config.js file.');
        }
      );
    }
  }
}

// Setup subscribers, publishers, archiving, signaling
const setupFeatures = ( args = {} ) => {
  const { session, token } = args;

  const layoutContainer = document.getElementById( 'layout' );

  const options = {
    maxRatio: 3/2,
    minRatio: 9/16,
    fixedRatio: false,
    bigMaxRatio: 3/2,
    bigMinRatio: 9/16,
    bigFirst: true,
    animate: true,
    animateDuration: 200,
    animateEasing: "swing",
    window,
  };

  // Initialize the layout container and get a reference to the layout method
  const { layout } = initLayoutContainer( layoutContainer, options );

  updateStreams( session, layout );

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

  const broadcastStartBtn = document.querySelector( '#bStart' );
  const broadcastStopBtn = document.querySelector( '#bStop' );

  broadcastStartBtn.addEventListener( 'click', event => {
    event.preventDefault();

    startBroadcast( session );
  } );

  broadcastStopBtn.addEventListener( 'click', event => {
    event.preventDefault();

    stopBroadcast( session );
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

const startBroadcast = session => {
  const cb = json => {
    const { broadcastId } = json;

    if ( !broadcastId ) {
      document.querySelector( '#view' ).disabled = true;

      document.querySelector( '#bStart' ).disabled = true;
      document.querySelector( '#bStop' ).disabled = false;

      fetch( `${SAMPLE_SERVER_BASE_URL}/broadcast/start`, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json',
        },
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        body: JSON.stringify( { sessionId } ),
      } ).then( res => res.json() )
        .then( broadcast => {
          if ( !broadcast ) return;
          console.log( `Successfully started broadcast - data returned: ${broadcast.id}` );
          session && session.signal( {
            type: 'broadcast',
            data: `${name} started a broadcast`
          }, error => {
            if ( error ) {
              console.error( `Error sending signal: ${error.name}, ${error.message}` );
            }
          } );
        } ).catch( error => {
          handleError(error);
          console.log( 'No streams in session now' );
        }
      );
    } else {
      alert( 'A broadcast is already running. Please join as a Broadcast Viewer to view the broadcast' );
    }
  };

  changeBroadcastStatus( cb )
}

const stopBroadcast = session => {
  document.querySelector( '#bStart' ).disabled = false;
  document.querySelector( '#bStop' ).disabled = true;

  const cb = json => {
    const { broadcastId } = json;
    if ( broadcastId ) {
      fetch( `${SAMPLE_SERVER_BASE_URL}/broadcast/${broadcastId}/stop` )
        .then( res => res.json() )
        .then( data => {
          console.log( `Successfully stopped broadcast - data returned: ${data}` );
          const broadcastLink = document.querySelector( "#broadcastLink" );
          broadcastLink.href = "";
          broadcastLink.textContent = "";
          session && session.signal( {
            type: 'broadcast',
            data: `${name} stopped a broadcast`
          }, error => {
            if ( error ) {
              console.error( `Error sending signal: ${error.name}, ${error.message}` );
            }
          } );
        } ).catch( err => {
          console.log( `Error calling stopBroadcast - message: ${err}` );
        } );
    } else {
      alert( 'No broadcast running at the moment' );
    }
  };

  changeBroadcastStatus( cb );
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