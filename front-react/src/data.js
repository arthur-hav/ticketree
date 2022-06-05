import { QueryClient, QueryClientProvider, useQuery } from 'react-query'
import { useState } from "react";
import React from "react";

const queryClient = new QueryClient()

const status_list = ["Canceled", "Open", "In progress", "Done"]
const new_ticket = {
    title: 'Title',
    status: 'Open',
    description: 'Description',
    organization: null,
    assignee: null,
    parent_id: null,
    ticket_type: 'incident'
}
function create_son(ticket_obj, set_all_tck){
    var son_tck = {
        ...new_ticket
    };
    son_tck.parent = ticket_obj.ticket_id;
    create_ticket(son_tck, set_all_tck);
}
function create_ticket(ticket_obj, set_all_tck){
    var url = `${process.env.REACT_APP_API_SERVER}/api/tickets`
    var xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify(ticket_obj));
    set_all_tck(undefined)
}

export default function DataProvider() {
   return (
     <QueryClientProvider client={queryClient}>
       <Example />
     </QueryClientProvider>
   )
}

function set_title(tck, set_ticket, event, all_tck, set_all_tck){
    tck.title = event.target.value;
    put_ticket(tck, set_ticket, all_tck, set_all_tck);
}

function set_description(tck, set_ticket, event, all_tck, set_all_tck){
    tck.description = event.target.value;
    put_ticket(tck, set_ticket, all_tck, set_all_tck);
}

function set_status(tck, set_ticket, all_tck, set_all_tck, dir){
    const new_status_idx = status_list.indexOf(tck.status) + dir
    tck.status = status_list[new_status_idx]
    put_ticket(tck, set_ticket, all_tck, set_all_tck)
}


function put_ticket(ticket, set_ticket, all_tck, set_all_tck){
    var url = `${process.env.REACT_APP_API_SERVER}/api/tickets`
    var xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify(ticket));
    const new_tck = {tickets: all_tck.tickets.map((tck) => tck.ticket_id !== ticket.ticket_id ? tck : { ...ticket})}
    set_all_tck(new_tck)
    set_ticket({ ...ticket})
}

class TitleArea extends React.Component {
    constructor(props) {
        super(props);
        this.state = {title: props.ticket.title}
    }
    shouldComponentUpdate(nextProps) {
        if(nextProps.ticket.ticket_id !== this.props.ticket.ticket_id) {
            this.setState({title: nextProps.ticket.title})
            return true;
        }
        else if (nextProps.ticket.title !== this.state.title) {
            return true;
        }
        return false;
    }
    updateText = (event) => {
        event.preventDefault();
        this.setState({title: event.target.value});
    }
    render() {
        return (
            <textarea className="pane-title edit-text"
                value={this.state.title}
                onChange={this.updateText}
                onBlur={(event) => set_title(this.props.ticket, this.props.set_ticket, event, this.props.all_tck, this.props.set_all_tck)}>
            </textarea>);
    }
}

class DescArea extends React.Component {
    constructor(props) {
        super(props);
        this.state = {description: props.ticket.description}
    }
    shouldComponentUpdate(nextProps) {
        if(nextProps.ticket.ticket_id !== this.props.ticket.ticket_id) {
            this.setState({description: nextProps.ticket.description})
            return true;
        }
        else if (nextProps.ticket.description !== this.state.description) {
            return true;
        }
        return false;
    }
    updateText = (event) => {
        event.preventDefault();
        this.setState({description: event.target.value});
    }
    render() {
        return (
            <textarea className="pane-description edit-text"
                value={this.state.description}
                onChange={this.updateText}
                onBlur={(event) => set_description(this.props.ticket, this.props.set_ticket, event, this.props.all_tck, this.props.set_all_tck)}>
            </textarea>);
    }
}



const PaneLeft: React.FC<Props> = ({
  ticket,
  set_ticket,
  all_tck,
  set_all_tck
}) => {
      if (!ticket){
        return (
          <h4>Select a ticket to see its details</h4>
        );
      }
      return (
      <div>
        <div>
            <TitleArea ticket={ticket} set_ticket={set_ticket} all_tck={all_tck} set_all_tck={set_all_tck}/>
        </div>
        <div className="align-center">
          <span className="status-group">
            {ticket.status === 'Canceled' ? <div className="flexbtn"></div>:
            <button className="btn flexbtn" onClick={() => set_status(ticket, set_ticket, all_tck, set_all_tck, - 1)}>&#9664;</button>}
            <span className="status-badge flex1">{ticket.status}</span>
            {ticket.status === 'Done' ? <div className="flexbtn"></div>:
            <button className="btn flexbtn" onClick={() => set_status(ticket, set_ticket, all_tck, set_all_tck, + 1)}>&#9654;</button>}
          </span>
        </div>
        <div>
          <DescArea ticket={ticket} set_ticket={set_ticket} all_tck={all_tck} set_all_tck={set_all_tck} />
        </div>
        <div>
          {ticket.assignee}
        </div>
        <div>
          {ticket.owner}
        </div>
      </div>
      );
}



function Example() {
    const [get_selected, set_selected] = useState()
    const [all_tck, set_all_tck] = useState()
    const { isLoading, error, data } = useQuery('ticketsData', () =>
      fetch(`${process.env.REACT_APP_API_SERVER}/api/tickets`).then(res => res.json())
    )
    if (data && typeof(all_tck) === 'undefined'){
        set_all_tck(data)
        return
    }

    if (isLoading) return 'Loading...'

    if (error) return 'An error has occurred: ' + error.message
    const progress_obj = {
        Open: "Open.png",
        Canceled: "Canceled.png",
        Done: "Done.png"
    }
    progress_obj["In progress"] = "Inprogress.png"

    const tickets = all_tck.tickets.map((tck) => {
    const progress =  process.env.PUBLIC_URL + '/static/img/' + progress_obj[tck.status];
    return (
      <div className="ticket-row paper" key={tck.ticket_id}>
        <div className="title ib" onClick={() => set_selected(tck)}>
           <h5>{tck.title}</h5>
        </div>
        <div className="icons ib">
          <img src={progress} alt={tck.status}></img>
        </div>
        <div className="bradius-right ib">
          <button type="button" className="btn btn-secondary dropdown-toggle dropdown-toggle-split"
             data-bs-toggle="dropdown" aria-expanded="false">
            <span className="visually-hidden">Toggle Dropdown</span>
          </button>
          <ul className="dropdown-menu dropdown-menu-end">
            <li><span className="dropdown-item" onClick={() => create_son(tck, set_all_tck)}>Create son</span></li>
          </ul>
        </div>
      </div>
    );
   });



   return (
   <div>
     <div className="pane-left">
       <PaneLeft ticket={get_selected} set_ticket={set_selected} all_tck={all_tck} set_all_tck={set_all_tck}/>
     </div>
     <div className="tickets-table">
       <button className="ticket-row add-ticket" onClick={() => create_ticket(new_ticket, set_all_tck)}>
         <h4>Add a new ticket</h4>
       </button>
       {tickets}
     </div>
   </div>
   )
}