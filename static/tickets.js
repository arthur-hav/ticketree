function panel_select(elem){
    ticket_obj = {
        id: elem.getElementsByClassName('ticket-id')[0].textContent,
        title: elem.getElementsByClassName('ticket-title')[0].textContent,
        status: elem.getElementsByClassName('status')[0].textContent,
        description: elem.getElementsByClassName('description')[0].textContent,
        organization: elem.getElementsByClassName('organization')[0].textContent,
        assignee: elem.getElementsByClassName('assignee')[0].textContent,
        owner: elem.getElementsByClassName('owner')[0].textContent,
        parent_id: elem.getElementsByClassName('parent_id')[0].textContent,
        ticket_type: 'incident'
    }
    for (k in ticket_obj){
        if (ticket_obj[k].length === 0){
            continue

            ;
        }
        document.getElementsByClassName('left-panel')[0].dataset[k] = ticket_obj[k];
    }
    document.getElementsByTagName('h1')[0].textContent = ticket_obj.title;
    elements = document.querySelectorAll('h5')
    for (i=0; i < elements.length; i++){
        elements[i].classList.remove('bg-secondary');
        elements[i].onclick = put_status
        if (elements[i].textContent == ticket_obj.status){
            elements[i].classList.add('bg-primary');
        }
        else {
            elements[i].classList.add('bg-secondary');
        }
    }
    document.getElementsByTagName('p')[0].textContent = ticket_obj.description;
}

function put_status(event){

    postObj = {}
    for (k in document.getElementsByClassName('left-panel')[0].dataset){
        postObj[k] = document.getElementsByClassName('left-panel')[0].dataset[k];
    }
    postObj.status = event.target.textContent.toUpperCase()
    url = "./api/tickets/" + postObj.id

    var xhr = new XMLHttpRequest();
    xhr.open("PUT", url);

    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Content-Type", "application/json");

    xhr.send(JSON.stringify(postObj));
    xhr.onload = function () {
        location.reload()
    }
}