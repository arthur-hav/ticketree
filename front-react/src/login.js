import './css/common.css';

export default function Login() {
    return (
    <main class="form-signin w-100 m-auto">
      <form method="post">
        <input type="text" id="form-username" name="username" class="form-control paper" placeholder="Your name"/>
        <input type="password" id="form-password" name="password" class="form-control paper" placeholder="Password"/>
        <input type="submit" value="Login" class="w-100 btn btn-lg btn-success" />
        <input type="hidden" name="csrf" value="{{ csrf }}"/>
      </form>
    </main>
    );
}