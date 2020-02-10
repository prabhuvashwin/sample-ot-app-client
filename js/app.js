let archiveId;

const handleError = error => {
  if ( error ) {
    console.error( error );
  }
};

const setupTextChat = session => {
  // =============== Setup text chat ===============
  const form = document.querySelector( 'form' );
  const msgTxt = document.querySelector( '#msgTxt' );

  // Send a signal once the user enters data in the form
  form.addEventListener( 'submit', event => {
    event.preventDefault();

    session && session.signal( {
      type: 'msg',
      data: msgTxt.value
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

const init = () => {

  // Set initial states for archiving buttons
  document.querySelector( '#start' ).classList.remove( 'hide' );
  document.querySelector( '#view' ).classList.add( 'hide' );
  document.querySelector( '#stop' ).classList.add( 'hide' );
  archiveId = null;

  // Get apiKey, sessionId, token info and initialize session
  if ( SAMPLE_SERVER_BASE_URL ) {
    fetch( `${SAMPLE_SERVER_BASE_URL}/session` )
      .then( res => res.json() )
      .then( json => {
        const { apiKey, sessionId, token } = json;

        if ( !apiKey || !sessionId && !token ) return;

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

// Setup subscribers, publishers, archiving, signaling
const setupFeatures = ( args = {} ) => {
  const { session, token } = args;

  // Subscribe to a newly created stream
  session.on( 'streamCreated', event => {
    const subscriberOptions = {
      insertMode: 'append',
      width: '100%',
      height: '100%'
    };
    session.subscribe( event.stream, 'subscriber', subscriberOptions, handleError );
  } );

  // Start the archive
  session.on( 'archiveStarted', event => {
    archiveId = event.id;
    console.log( `Archive started: ${archiveId}` );
    document.querySelector( '#stop' ).classList.remove( 'hide' );
    document.querySelector( '#start' ).classList.add( 'hide' );
  } );

  // Stop the archive
  session.on( 'archiveStopped', event => {
    archiveId = event.id;
    console.log( `Archive stopped: ${archiveId}` );
    document.querySelector( '#start' ).classList.add( 'hide' );
    document.querySelector( '#stop' ).classList.add( 'hide' );
    document.querySelector( '#view' ).classList.remove( 'hide' );
  } );

  session.on( 'sessionDisconnected', event => {
    console.log( `You were disconnected from the session: ${event.reason}` );
  } );

  // initialize the publisher
  const publisherOptions = {
    insertMode: 'append',
    width: '100%',
    height: '100%',
  };
  const publisher = OT.initPublisher( 'publisher', publisherOptions, handleError );

  // Connect to the session
  session.connect( token, error => {
    if ( error ) {
      handleError( error );
    } else {
      // If the connection is successful, publish the publisher to the session
      session.publish( publisher, handleError );
    }
  } );

  // Receive a message and append it to the history
  const msgHistory = document.querySelector( '#history' );
  session.on( 'signal:msg', event => {
    const msg = document.createElement( 'p' );
    msg.textContent = event.data;
    msg.className = event.from.connectionId === session.connection.connectionId ? 'mine' : 'theirs';
    msgHistory.appendChild( msg );
    msg.scrollIntoView();
  } );
}

// Start recording
const startArchive = () => { // eslint-disable-line no-unused-vars
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

  document.querySelector( '#start' ).classList.add( 'hide' );
  document.querySelector( '#stop' ).classList.remove( 'hide' );
}

// Stop recording
const stopArchive = () => { // eslint-disable-line no-unused-vars
  fetch( `${SAMPLE_SERVER_BASE_URL}/archive/${archiveId}/stop` )
    .then( response => {
      console.log( `stopArchive() complete - response: ${response}` );
      return response.json();
    } ).then( data => {
      console.log( `Successfully stopped archive - data returned: ${data}` );
    } ).catch( err => {
      console.log( `Error calling stopArchive - message: ${err}` );
    } );
  document.querySelector( '#stop' ).classList.add( 'hide' );
  document.querySelector( '#view' ).disabled = false;
  document.querySelector( '#stop' ).classList.remove( 'hide' );
}

// Get the archive status. If it is  "available", download it. Otherwise, keep checking
// every 5 secs until it is "available"
const viewArchive = () => { // eslint-disable-line no-unused-vars
  document.querySelector( '#view' ).disabled = true;
  window.location = `${SAMPLE_SERVER_BASE_URL}/archive/${archiveId}/view`;
}

// Run init()
init();