import { useQuery } from 'react-query'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import TextareaAutosize from 'react-textarea-autosize';
import React from "react";
import { ImgIcon } from "./components/imgicon.js"
import Select from 'react-select'

const customStyles = {
  menu: (provided, state) => ({
    ...provided,
    backgroundColor: "#1f441f",
  }),
  control: (provided, state) => ({
    ...provided,
    backgroundColor: "#447744",
  })
}

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

function set_parent(value, tck, set_ticket, all_tck, set_all_tck){
    tck.parent = value;
    put_ticket(tck, set_ticket, all_tck, set_all_tck);
}

function set_organization(value, tck, set_ticket, all_tck, set_all_tck){
    tck.organization = value
    put_ticket(tck, set_ticket, all_tck, set_all_tck)
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
        this.state = {label: "<Unassigned>", value: null};
        for (var user_idx in this.props.user_data.users){
            if (this.props.tck.assignee === this.props.user_data.users[user_idx].user_id){
                this.state = {value: this.props.user_id, label: this.props.user_data.users[user_idx].display_name};
                break;
            }
        }
    }
     shouldComponentUpdate(nextProps) {
        if(nextProps.tck.ticket_id !== this.props.tck.ticket_id) {
            var display_name = "<Unassigned>";
            for (var user_idx in this.props.user_data.users){
                if (nextProps.tck.assignee === this.props.user_data.users[user_idx].user_id){
                    display_name = this.props.user_data.users[user_idx].display_name;
                    break;
                }
            }
            this.setState({value: nextProps.tck.assignee, label: display_name})
        }
        return true;
    }
    onchange (event, option, tck, set_tck, all_tck, set_all_tck){
        if (!option || !option.value){
            this.setState({value: null, label: "<Unassigned>"});
            tck.assignee = null;
        }
        else {
            tck.assignee = option.value;
            this.setState(option);
        }
        put_ticket(tck, set_tck, all_tck, set_all_tck);
    }
    render(){
        var options = this.props.user_data.users.map(user => {return {label: user.display_name, value: user.user_id}})
        options.push({label: "<Unassigned>", value: null})
        return (
            <div className='flex'>
                <span className="autocomplete-icon">
                <ImgIcon img_id={this.state.value} />
                </span>
                <Autocomplete
                  options={options}
                  value={{label: this.state.label, value: this.state.value}}
                  isOptionEqualToValue={(option, value) => option.value === value.value}
                  onChange={(event, value) => this.onchange(
                     event, value, this.props.tck, this.props.set_tck, this.props.all_tck, this.props.set_all_tck)}
                  sx={{ width: '320px' }}
                  renderInput={(params) => <TextField {...params} label="Assignee" variant="standard"/>}
                  />
            </div>
        );
    }
}


class ParentBox extends React.Component{
    upValue(props) {
        var options = props.all_tck.tickets.map((tck) => {
            if (tck.ticket_id === props.ticket.ticket_id){
                return {value:null, label: '<Root ticket>'}
            }
             return {label: tck.title, value: tck.ticket_id}
        })
        if (props.all_tck && props.all_tck.tickets){
            for (var tck_idx in props.all_tck.tickets) {
                var parent_candidate = props.all_tck.tickets[tck_idx]
                if (parent_candidate.ticket_id === props.ticket.parent){
                    return {value: parent_candidate.ticket_id, label: parent_candidate.title, options: options}
                }
            }
        }

        return {value: null, label: '<Root ticket>', options: options}
    }

    constructor(props) {
        super(props);
        this.state = this.upValue(props)
    }
    shouldComponentUpdate(nextProps) {
        if(nextProps.ticket.ticket_id !== this.props.ticket.ticket_id) {
            this.setState(this.upValue(nextProps))
        }
        return true;
    }
    updateValue = (option) => {
        console.log(option)
        if (!option){
            this.setState({value: null, label: '<Root ticket>'})
        }
        else {
            this.setState(option);
        }
    }
    render() {
        return (
        <div className="flex">
          <span className="autocomplete-icon">
            <ImgIcon img_id={this.state.value} />
          </span>
          <Autocomplete
          options={this.state.options}
          value={{label: this.state.label, value: this.state.value}}
          isOptionEqualToValue={(option, value) => option.value === value.value}
          onChange={(event, option) => {this.updateValue(option);
                    set_parent(option.value, this.props.ticket, this.props.set_ticket,
                                     this.props.all_tck, this.props.set_all_tck)}}
          sx={{ width: '320px' }}
          renderInput={(params) => <TextField {...params} label="Parent" variant="standard"/>}
          />
        </div>
        );
    }
}


class OrgBox extends React.Component{
    upValue(props) {
        if (props.orgs){
            var options = props.orgs.map((org_candidate) => {
                return {label: org_candidate.display_name, value: org_candidate.organization_id}
            })
            options.push({value: null, label: '<Private ticket>'})
            for (var org_idx in props.orgs) {
                var org_candidate =  props.orgs[org_idx]
                if (org_candidate.organization_id === props.ticket.organization){
                    return {value: org_candidate.organization_id, label: org_candidate.display_name, options: options}
                }
            }
        }
        return {value: null, label: '<Private ticket>', options: options}
    }

    constructor(props) {
        super(props);
        this.state = this.upValue(props)
    }
    shouldComponentUpdate(nextProps) {
        if(nextProps.ticket.ticket_id !== this.props.ticket.ticket_id) {
            this.setState(this.upValue(nextProps))
        }
        return true;
    }
    updateValue = (value) => {
        if (!value){
            this.setState({value: null, label: '<Private ticket>'})
        }
        else {
            this.setState(value);
        }
    }
    render() {
        return (
        <div className="flex">
          <span className="autocomplete-icon">
            <ImgIcon img_id={this.state.value} />
          </span>
          <Autocomplete
          options={this.state.options}
          value={{label: this.state.label, value: this.state.value}}
          isOptionEqualToValue={(option, value) => option.value === value.value}
          onChange={(event, option) => {this.updateValue(option);
                    set_organization(option.value, this.props.ticket, this.props.set_ticket,
                                     this.props.all_tck, this.props.set_all_tck)}}
          sx={{ width: '320px' }}
          renderInput={(params) => <TextField {...params} label="Organization" variant="standard"/>}
          />
        </div>
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
      }
      var owner_name = null
      console.log(data.users, ticket.owner)
      for (var user_idx in data.users){
        if (data.users[user_idx].user_id == ticket.owner){
            owner_name = data.users[user_idx].display_name
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
          <div className="flex">
          <span className="autocomplete-icon">
          <ImgIcon img_id={ticket.owner} />
          </span>
          <Autocomplete value={owner_name} disabled={true} options={[]} sx={{ width: '320px' }}
                  renderInput={(params) => <TextField {...params} label="Owner" variant="standard"/>} />
          </div>
        </div>
        <OrgBox ticket={ticket} set_ticket={set_ticket} all_tck={all_tck} set_all_tck={set_all_tck} orgs={my_profile.org_list} />
        <ParentBox ticket={ticket} set_ticket={set_ticket} all_tck={all_tck} set_all_tck={set_all_tck} />
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