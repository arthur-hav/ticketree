import TextareaAutosize from 'react-textarea-autosize';
import React from "react";
import { useState } from "react";
import { ImgIcon } from "./components/imgicon.js";
import { useQuery } from 'react-query'
import Select from 'react-select'

const new_user = {
    username: 'New user',
}

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

class Organizations extends React.Component{
    upValue(props) {
        var current_user_org = [];
        if (props.user_org_data && props.org_data.data.organizations){
            for (var user_org_idx in props.user_org_data.user_organization) {
                var user_org = props.user_org_data.user_organization[user_org_idx]
                if (user_org.user_id === props.user.user_id){
                    var label = "Undefined"
                    for (var org_idx in props.org_data.data.organizations) {

                        if (user_org.organization_id === props.org_data.data.organizations[org_idx].organization_id){
                            label = props.org_data.data.organizations[org_idx].display_name
                        }
                    }
                    current_user_org.push({value: props.user_org_data.user_organization[user_org_idx].organization_id,
                    label: label})
                }
            }
        }
        console.log(current_user_org)
        return current_user_org
    }

    constructor(props) {
        super(props);
        var options = [];
        if (props.org_data.data.organizations){
            options = props.org_data.data.organizations.map((org) => { return {label: org.display_name, value: org.organization_id}})
        }
        this.state = {value: this.upValue(props), options: options}
    }
    shouldComponentUpdate(nextProps) {
        if(nextProps.user !== this.props.user
           || nextProps.org_data.data.organizations !== this.props.org_data.data.organizations
           || nextProps.user_org_data !== this.props.user_org_data) {
            this.setState({value: this.upValue(nextProps)})
        }
        if(nextProps.options !== this.props.options) {
            this.setState({options: nextProps.options})
        }
        return true;
    }
    updateValue = (value) => {
        this.setState({value: value});
    }
    render() {
        return <Select isMulti="true" options={this.state.options} styles={customStyles} value={this.state.value}
            onChange={this.updateValue}
            onBlur={() => set_organization(this.state.value, this.props.user, this.props.user_org_data, this.props.set_user_org_data)}/>
    }
}

function create_user_element(all_tck, set_all_tck, my_profile){
    return (
       <button className="ticket-row add-ticket" onClick={() => create_user(new_user, all_tck, set_all_tck)}>
         <h4>Add a new user</h4>
       </button>
    );
}

function specific_search_user(elem){
return "";
}

function users_from_json(all_tck, search, set_selected){
    const fltr_users = all_tck.users.filter(user => typeof(search) === "undefined"
                                            || user.username.toLowerCase().includes(search.string.toLowerCase()))
    const users = fltr_users.map((user) => {
    return (
      <div className="ticket-row ticket-paper" key={user.user_id} onClick={() => set_selected(user)}>
        <div className="icons">
          <ImgIcon img_id={user.user_id} />
        </div>
        <div className="title" >
           <h5>{user.username}</h5>
        </div>
      </div>
    );
   });
   return users;
}

function create_user(user, all_tck, set_all_tck){
    var myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    const url = `${process.env.REACT_APP_API_SERVER}/api/profile`
    const request = new Request(url, {method: 'POST', body: JSON.stringify(user), headers:myHeaders});
    fetch (request).then(response => response.json()).then(data => {
        var obj = { ...user}
        obj.user_id = data.user_id;
        set_all_tck({users: all_tck.users.concat([obj])});
    });

}

function set_username(user, set_ticket, event, all_tck, set_all_tck){
    user.username = event.target.value;
    put_user(user, set_ticket, all_tck, set_all_tck);
}

function set_organization(value, user, user_org_data, set_user_org_data){
    var new_org_data = {user_organization: value.map((option) => {return {user_id: user.user_id, organization_id: option.value};})}
    for (var idx in user_org_data.user_organization) {
        if (user_org_data.user_organization[idx].user_id !== user.user_id){
            new_org_data.user_organization.push(user_org_data.user_organization[idx])
        }
    }
    set_user_org_data(new_org_data);
    var myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    const url = `${process.env.REACT_APP_API_SERVER}/api/user_organization/${user.user_id}`
    const request = new Request(url, {method: 'PUT', body: JSON.stringify(
           {lst: value.map((val) => val.value)}), headers: myHeaders});
    fetch(request);
}

function put_user(user, set_ticket, all_tck, set_all_tck){
    var myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    const url = `${process.env.REACT_APP_API_SERVER}/api/profiles/${user.user_id}`
    const request = new Request(url, {method: 'PUT', body: JSON.stringify(user), headers: myHeaders});
    fetch(request);
    const new_tck = {users: all_tck.users.map((usr) => usr.user_id !== user.user_id ? usr : { ...user})}
    set_all_tck(new_tck)
    set_ticket({ ...user})
}

class UsernameArea extends React.Component {
    constructor(props) {
        super(props);
        this.state = {username: props.user.username}
    }
    shouldComponentUpdate(nextProps) {
        if(nextProps.user.username !== this.props.user.username) {
            this.setState({username: nextProps.user.username})
        }
        return true;
    }
    updateText = (event) => {
        event.preventDefault();
        this.setState({username: event.target.value});
    }
    render() {
        return (
            <TextareaAutosize className="pane-title edit-text"
                value={this.state.username}
                onChange={this.updateText}
                onBlur={(event) => set_username(this.props.user, this.props.set_ticket, event, this.props.all_tck, this.props.set_all_tck)}>
            </TextareaAutosize>
        );
    }
}


const PaneLeft: React.FC<Props> = ({
  ticket,
  set_ticket,
  all_tck,
  set_all_tck,
  my_profile
}) => {
    const org_data = useQuery('organizationData', () =>
          fetch(`${process.env.REACT_APP_API_SERVER}/api/organizations`).then(res => res.json()))

    const query_user_org_data = useQuery('userOrgData', () =>
          fetch(`${process.env.REACT_APP_API_SERVER}/api/user_organization`).then(res => res.json()))

    const [user_org_data, set_user_org_data] = useState();
    if (!ticket){
        return (
          <div className="pane-left">
            <h4>Select a user to see its details</h4>
          </div>
        );
      }
    if (query_user_org_data.data && !user_org_data){
        console.log(query_user_org_data.data)
        set_user_org_data(query_user_org_data.data)
    }
      return (
      <div className="pane-left">
        <div>
          <ImgIcon img_id={ticket.user_id} />
        </div>
        <UsernameArea user={ticket} set_ticket={set_ticket} all_tck={all_tck} set_all_tck={set_all_tck}/>
        <Organizations org_data={org_data} user_org_data={user_org_data} set_user_org_data={set_user_org_data}
          user={ticket} />
      </div>
      );
}

export const export_user = {
    create: create_user_element,
    from_json: users_from_json,
    pane_left: PaneLeft,
    search: specific_search_user,
}