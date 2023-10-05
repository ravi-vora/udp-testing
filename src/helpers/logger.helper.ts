import { LOG } from "./utils.helper.js";

export const showError = (e: Error) => {
  console.log(
    '-------------------------------------------------------------------------------------------',
  );
  let prepare = `??????????????? Something went wrong :: ${
    e.message
  } :: ${new Date()}`;
  console.log(prepare);
  console.trace(e);
  console.error(e);
  console.log(
    '-------------------------------------------------------------------------------------------',
  );
};

export const debugging = (message: any) => {
  console.log(
    `------------------------------------------- ${new Date()} ------------------------------------------------`,
  );
  console.log('@@@@@@@@@@@@@@@@@ DEBUG START @@@@@@@@@@@@@@@@@');
  console.log(message);
  console.log('@@@@@@@@@@@@@@@@@ DEBUG END @@@@@@@@@@@@@@@@@');
  console.log(
    `------------------------------------------- ${new Date()} ------------------------------------------------`,
  );
};
