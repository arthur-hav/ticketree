import TextareaAutosize from 'react-textarea-autosize';
import React from "react";

const new_user = {
    username: 'New user',
}



function create_user_element(all_tck, set_all_tck){
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
                                            || user.username.toLowerCase().includes(search.string.toLowerCase())
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
    const url = `${process.env.REACT_APP_API_SERVER}/api/users`
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

function put_user(user, set_ticket, all_tck, set_all_tck){
    var myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    const url = `${process.env.REACT_APP_API_SERVER}/api/users`
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

class ImgIcon extends React.Component {
    render() {
        if (!this.props.img_id) return;
        const img_src = `${process.env.REACT_APP_API_SERVER}/img/${this.props.img_id}`
        return <img src={img_src} alt={this.props.img_id}></img>
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
            <h4>Select a user to see its details</h4>
          </div>
        );
      }
      return (
      <div className="pane-left">
        <div>
          <ImgIcon img_id={ticket.user_id} />
        </div>
        <UsernameArea user={ticket} set_ticket={set_ticket} all_tck={all_tck} set_all_tck={set_all_tck}/>
      </div>
      );
}

export const export_user = {
    create: create_user_element,
    from_json: users_from_json,
    pane_left: PaneLeft,
    search: specific_search_user,
}