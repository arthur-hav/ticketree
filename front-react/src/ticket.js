import { useQuery } from 'react-query'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import TextareaAutosize from 'react-textarea-autosize';
import React from "react";
import { ImgIcon } from "./components/imgicon.js"

const status_list = ["Canceled", "Open", "In progress", "Done"]
const new_ticket = {
    title: 'Title',
    status: 'Open',
    description: 'Description',
    organization: null,
    assignee: null,
    parent: null,
    ticket_type: 'incident',
    owner: null
}
const progress_obj = {
    Open: process.env.PUBLIC_URL + "/static/img/Open.png",
    Canceled: process.env.PUBLIC_URL + "/static/img/Canceled.png",
    Done: process.env.PUBLIC_URL + "/static/img/Done.png"
}
progress_obj["In progress"] = process.env.PUBLIC_URL + "/static/img/Inprogress.png"



function create_ticket_element(all_tck, set_all_tck, my_profile){
    return (
       <button className="ticket-row add-ticket" onClick={() => create_ticket(new_ticket, all_tck, set_all_tck, my_profile)}>
         <h4>Add a new ticket</h4>
       </button>
    );
}

function specific_search_ticket(elem){
return (
        <span>
           <input type="checkbox" defaultChecked={elem.state.status["Canceled"]}
             onChange={(event) => elem.replace_status(event, "Canceled")} />
           <img src={progress_obj["Canceled"]} alt="Canceled"></img>
           <input type="checkbox" defaultChecked={elem.state.status["Open"]}
             onChange={(event) => elem.replace_status(event, "Open")} />
           <img src={progress_obj["Open"]} alt="Open"></img>
           <input type="checkbox" defaultChecked={elem.state.status["In progress"]}
             onChange={(event) => elem.replace_status(event, "In progress")} />
           <img src={progress_obj["In progress"]} alt="In progress"></img>
           <input type="checkbox" defaultChecked={elem.state.status["Done"]}
             onChange={(event) => elem.replace_status(event, "Done")} />
           <img src={progress_obj["Done"]} alt="Done"></img>
        </span>
           );
}

function create_son(parent_tck, all_tck, set_all_tck, my_profile){
    var son_tck = { ...new_ticket}
    son_tck.parent = parent_tck.ticket_id;
    create_ticket(son_tck, all_tck, set_all_tck, my_profile);
}

export function tickets_from_json(all_tck, search, set_selected){
    const fltr_tck = all_tck.tickets.filter(ticket => typeof(search) === "undefined"
                                            || ((ticket.title.toLowerCase().includes(search.string.toLowerCase())
                                                 || ticket.description.toLowerCase().includes(search.string.toLowerCase()))
                                                && search.status[ticket.status]))

    const tickets = fltr_tck.map((tck) => {
    return (
      <div className="ticket-row ticket-paper" key={tck.ticket_id} onClick={() => set_selected(tck)}>
        <div className="title">
           <h5>{tck.title}</h5>
        </div>
        <div className="icons">
          <ImgIcon img_id={tck.assignee} />
        </div>
        <div className="icons">
          <img src={progress_obj[tck.status]} alt={tck.status}></img>
        </div>
      </div>
    );
   });
   return tickets;
}

function create_ticket(ticket, all_tck, set_all_tck, my_profile){
    var myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    const url = `${process.env.REACT_APP_API_SERVER}/api/tickets`
    const request = new Request(url, {method: 'POST', body: JSON.stringify(ticket), headers:myHeaders});
    fetch (request).then(response => response.json()).then(data => {
        var ticket_obj = { ...ticket}
        ticket_obj.ticket_id = data.ticket_id;
        ticket_obj.owner = my_profile.user_id
        set_all_tck({tickets: all_tck.tickets.concat([ticket_obj])});
    });

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
    const url = `${process.env.REACT_APP_API_SERVER}/api/tickets/${ticket.ticket_id}`
    const request = new Request(url, {method: 'PUT', body: JSON.stringify(ticket), headers: myHeaders});
    fetch(request);
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


class UserBadge extends React.Component {
    constructor(props){
        super(props);
        this.state = {user_id: null, username: null};
        for (var user_idx in this.props.user_data.users){
            if (this.props.tck.assignee === this.props.user_data.users[user_idx].user_id){
                this.state = {user_id: this.props.user_id, username:this.props.user_data.users[user_idx].username};
                break;
            }
        }
    }
     shouldComponentUpdate(nextProps) {
        if(nextProps.tck !== this.props.tck) {
            var username = null;
            for (var user_idx in this.props.user_data.users){
                if (nextProps.tck.assignee === this.props.user_data.users[user_idx].user_id){
                    username = this.props.user_data.users[user_idx].username;
                    break;
                }
            }
            this.setState({user_id: nextProps.tck.assignee, username: username})
        }
        return true;
    }
    onchange (event, value, tck, set_tck, all_tck, set_all_tck){
        if (!value){
            this.setState({user_id: null, username: null});
            tck.assignee = null;
        }
        for (var user_idx in this.props.user_data.users){
            if (value === this.props.user_data.users[user_idx].username){
                this.setState({user_id: this.props.user_data.users[user_idx].user_id});
                tck.assignee = this.props.user_data.users[user_idx].user_id;
                break;
            }
        }
        this.setState({username: value});
        put_ticket(tck, set_tck, all_tck, set_all_tck);
    }
    render(){
        return (
            <span className='user-badge'>
                <ImgIcon img_id={this.state.user_id} />
                <UserCombo username={this.state.username} onChange={(event, value) => this.onchange(
                     event, value, this.props.tck, this.props.set_tck, this.props.all_tck, this.props.set_all_tck)}
                 user_data={this.props.user_data} />
            </span>
        );
    }
}


const UserCombo: React.FC<props> = ({
    username,
    user_data,
    onChange
    }) => {

    if (!user_data) return;
    var options = []
    for (var user_idx in user_data.users) {
        options.push(user_data.users[user_idx].username)
    }
    return (
        <Autocomplete
          disablePortal
          options={options}
          value={username}
          onChange={onChange}
          sx={{ width: '320px' }}
          renderInput={(params) => <TextField {...params} label="Assignee" variant="standard"/>}
        />
    );
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

export const PaneLeft: React.FC<Props> = ({
  ticket,
  set_ticket,
  all_tck,
  set_all_tck,
  my_profile
}) => {
      const { isLoading, error, data } = useQuery('profilesData', () =>
          fetch(`${process.env.REACT_APP_API_SERVER}/api/profiles`).then(res => res.json()))
      if (!ticket || isLoading || error){
        return (
          <div className="pane-left">
            <h4>Select a ticket to see its details</h4>
          </div>
        );
      }
      var sons = []
      var parents = [];
      for (var tck_idx in all_tck.tickets){
        if(ticket.ticket_id && all_tck.tickets[tck_idx].parent === ticket.ticket_id){
            const son_tck = all_tck.tickets[tck_idx]

            sons.push(
                <div className="ticket-row-mini ticket-paper"
                    key={son_tck.ticket_id}
                    onClick={() => set_ticket(son_tck)}>
                    <div className="flex1 title-mini">{son_tck.title}</div>
                    <div className="flexbtn icons">
                        <img src={progress_obj[son_tck.status]} alt={son_tck.status}></img>
                    </div>
                </div>
            )
        }
        else if (ticket.parent && all_tck.tickets[tck_idx].ticket_id === ticket.parent){
            const parent_tck = all_tck.tickets[tck_idx]

            parents.push(
                <div className="ticket-row-mini ticket-paper"
                    key={parent_tck.ticket_id}
                    onClick={() => set_ticket(parent_tck)}>
                    <div className="flex1 title-mini">{parent_tck.title}</div>
                    <div className="flexbtn icons">
                        <img src={progress_obj[parent_tck.status]} alt={parent_tck.status}></img>
                    </div>
                </div>
            )
        }
      }
      return (
      <div className="pane-left">
        <div>
          <ImgIcon img_id={ticket.ticket_id} />
        </div>
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
          <div>
          <UserBadge user_data={data} tck={ticket} set_tck={set_ticket}
           all_tck={all_tck} set_all_tck={set_all_tck} />
          </div>
          <div>
          <span>Owner: </span>
          <ImgIcon img_id={ticket.owner} />
          </div>
        </div>
        {parents}
        <div className="sons-container">
          <button className="add-ticket ticket-row-mini" onClick={() => create_son(ticket, all_tck, set_all_tck, my_profile)}>
            <span>Create son</span>
          </button>
          {sons}
        </div>
      </div>
      );
}

export const export_tck = {
 pane_left: PaneLeft,
 from_json: tickets_from_json,
 search: specific_search_ticket,
 create: create_ticket_element
}