import { QueryClient, QueryClientProvider, useQuery } from 'react-query'
import TextareaAutosize from 'react-textarea-autosize';
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
const progress_obj = {
    Open: process.env.PUBLIC_URL + "/static/img/Open.png",
    Canceled: process.env.PUBLIC_URL + "/static/img/Canceled.png",
    Done: process.env.PUBLIC_URL + "/static/img/Done.png"
}
progress_obj["In progress"] = process.env.PUBLIC_URL + "/static/img/Inprogress.png"


function create_son(parent_tck, all_tck, set_all_tck){
    var son_tck = { ...new_ticket}
    son_tck.parent_id = parent_tck.ticket_id;
    create_ticket(son_tck, all_tck, set_all_tck);
}
function create_ticket(ticket, all_tck, set_all_tck){
    var myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    const url = `${process.env.REACT_APP_API_SERVER}/api/tickets`
    const request = new Request(url, {method: 'POST', body: JSON.stringify(ticket), headers:myHeaders});
    fetch (request).then(response => response.json()).then(data => {
        var ticket_obj = { ...ticket}
        ticket_obj.ticket_id = data.ticket_id;
        set_all_tck({tickets: all_tck.tickets.concat([ticket_obj])});
    });

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
    var myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    const url = `${process.env.REACT_APP_API_SERVER}/api/tickets`
    const request = new Request(url, {method: 'PUT', body: JSON.stringify(ticket), headers: myHeaders});
    fetch(request);
    const new_tck = {tickets: all_tck.tickets.map((tck) => tck.ticket_id !== ticket.ticket_id ? tck : { ...ticket})}
    set_all_tck(new_tck)
    set_ticket({ ...ticket})
}

class FilterPane extends React.Component {
    constructor(props) {
        super(props)
        this.state = {string: "", status: {
            "Canceled": true,
            "Open": true,
            "In progress": true,
            "Done": true
            }}
    }

    apply_search = (event) => {
        this.setState({string: event.target.value})
        this.props.set_search(this.state)
    }

    replace_status = (event, status_name) => {
        this.setState((prevState => {
            var new_state = { ...prevState}
            new_state.status[status_name] = event.target.checked;
            this.props.set_search(new_state);
            return new_state}))
    }

    render () {
    return (
        <div className="filter-pane">
          <div>
            <label htmlFor="search"><h4>Search</h4></label>
            <input type="text" name="search" className="search-input" onChange={this.apply_search}/>
           <input type="checkbox" defaultChecked={this.state.status["Canceled"]}
             onChange={(event) => this.replace_status(event, "Canceled")} />
           <img src={progress_obj["Canceled"]} alt="Canceled"></img>
           <input type="checkbox" defaultChecked={this.state.status["Open"]}
             onChange={(event) => this.replace_status(event, "Open")} />
           <img src={progress_obj["Open"]} alt="Open"></img>
           <input type="checkbox" defaultChecked={this.state.status["In progress"]}
             onChange={(event) => this.replace_status(event, "In progress")} />
           <img src={progress_obj["In progress"]} alt="In progress"></img>
           <input type="checkbox" defaultChecked={this.state.status["Done"]}
             onChange={(event) => this.replace_status(event, "Done")} />
           <img src={progress_obj["Done"]} alt="Done"></img>
           </div>
        </div>
    );}
}

class TitleArea extends React.Component {
    constructor(props) {
        super(props);
        this.state = {title: props.ticket.title}
    }
    shouldComponentUpdate(nextProps) {
        if(nextProps.ticket.title !== this.props.ticket.title) {
            this.setState({title: nextProps.ticket.title})
        }
        return true;
    }
    updateText = (event) => {
        event.preventDefault();
        this.setState({title: event.target.value});
    }
    render() {
        return (
            <TextareaAutosize className="pane-title edit-text"
                value={this.state.title}
                onChange={this.updateText}
                onBlur={(event) => set_title(this.props.ticket, this.props.set_ticket, event, this.props.all_tck, this.props.set_all_tck)}>
            </TextareaAutosize>
        );
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
        }
        return true;
    }
    updateText = (event) => {
        event.preventDefault();
        this.setState({description: event.target.value});
    }
    render() {
        return (
            <TextareaAutosize className="pane-description edit-text"
                value={this.state.description}
                onChange={this.updateText}
                onBlur={(event) => set_description(this.props.ticket, this.props.set_ticket, event, this.props.all_tck, this.props.set_all_tck)}>
            </TextareaAutosize>);
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
          <div className="pane-left">
            <h4>Select a ticket to see its details</h4>
          </div>
        );
      }
      var sons = []
      for (var tck_idx in all_tck.tickets){
        if(ticket.ticket_id && all_tck.tickets[tck_idx].parent_id === ticket.ticket_id){
            const parent_tck = all_tck.tickets[tck_idx]
            sons.push(
                <div className="ticket-row-mini ticket-paper"
                    key={parent_tck.ticket_id}
                    onClick={() => set_ticket(parent_tck)}>
                    <div className="flex1 title-mini">{parent_tck.title}</div>
                    <div className="flexbtn icons">
                        <img src={progress_obj[ticket.status]} alt={ticket.status}></img>
                    </div>
                </div>
            )
        }
      }
      return (
      <div className="pane-left">
        <TitleArea ticket={ticket} set_ticket={set_ticket} all_tck={all_tck} set_all_tck={set_all_tck}/>
        <div className="align-center">
          <span className="status-group">
            {ticket.status === 'Canceled' ? <div className="flexbtn"></div>:
            <button className="btn flexbtn" onClick={() => set_status(ticket, set_ticket, all_tck, set_all_tck, - 1)}>&#9664;</button>}
            <span className="status-badge flex1">{ticket.status}</span>
            {ticket.status === 'Done' ? <div className="flexbtn"></div>:
            <button className="btn flexbtn" onClick={() => set_status(ticket, set_ticket, all_tck, set_all_tck, + 1)}>&#9654;</button>}
          </span>
        </div>
        <DescArea ticket={ticket} set_ticket={set_ticket} all_tck={all_tck} set_all_tck={set_all_tck} />
        <div>
          {ticket.assignee}
        </div>
        <div>
          {ticket.owner}
        </div>
        <div className="sons-container">
          <button className="add-ticket ticket-row-mini" onClick={() => create_son(ticket, all_tck, set_all_tck)}><span>Create son</span></button>
          {sons}
        </div>
      </div>
      );
}



function Example() {
    const [get_selected, set_selected] = useState()
    const [all_tck, set_all_tck] = useState()
    const [search, set_search] = useState()
    const { isLoading, error, data } = useQuery('ticketsData', () =>
      fetch(`${process.env.REACT_APP_API_SERVER}/api/tickets`).then(res => res.json())
    )
    if (data && typeof(all_tck) === 'undefined'){
        set_all_tck(data)
        return
    }

    if (isLoading) return 'Loading...'

    if (error) return 'An error has occurred: ' + error.message

    if (search)
        console.log('search - ' + search.status.Open)
    const fltr_tck = all_tck.tickets.filter(ticket => typeof(search) === "undefined"
                                            || ((ticket.title.toLowerCase().includes(search.string.toLowerCase())
                                                 || ticket.description.toLowerCase().includes(search.string.toLowerCase()))
                                                && search.status[ticket.status]))

    const tickets = fltr_tck.map((tck) => {
    return (
      <div className="ticket-row ticket-paper" key={tck.ticket_id}>
        <div className="title ib" onClick={() => set_selected(tck)}>
           <h5>{tck.title}</h5>
        </div>
        <div className="icons ib">
          <img src={progress_obj[tck.status]} alt={tck.status}></img>
        </div>
      </div>
    );
   });

   return (
   <div>
     <PaneLeft ticket={get_selected} set_ticket={set_selected} all_tck={all_tck} set_all_tck={set_all_tck}/>
     <FilterPane search={search} set_search={set_search}/>
     <div className="tickets-table">
       <button className="ticket-row add-ticket" onClick={() => create_ticket(new_ticket, all_tck, set_all_tck)}>
         <h4>Add a new ticket</h4>
       </button>
       {tickets}
     </div>
   </div>
   )
}