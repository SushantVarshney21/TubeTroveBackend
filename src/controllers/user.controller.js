import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefresTokens = async(userId)=>{
    try{
        const user = await User.findById(userId)

        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken

        await user.save({validateBeforeSave:false})

        return {accessToken, refreshToken}

    }catch(error){
        throw new ApiError(500, "something went wrong while generate access and refresh tokens")
    }
}

const registerUser = asyncHandler(async (req, res) => {
  const { email, username, fullname, password } = req.body;
  console.log(email);

  // if(
  //     [fullname,email,user,password].some((field)=>
  //         field?.trim() === "")
  // ){
  //     throw new ApiError(400, "All fields are required")
  // }

  const existsUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existsUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async(req,res)=>{
    const {username, email, password}= req.body

    if(!username || !email){
        throw new ApiError(500, "username or email is required")
    }

    const user = await User.findOne({$or: [{username},{email}]})

    if(!user){
        throw new ApiError(500, "user does not exists")
    }

    const isPasswordVailed = await  user.isPasswordCorrect(password)

    if(!isPasswordVailed){
        throw new ApiError(500, "Invailed user credentials")
    }

    const{accessToken, refreshToken}= await generateAccessAndRefresTokens(user._id)

    const logedinUser = await User.findById(user._id).select("-password -refreshToken")

    const option = {
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .cookie(accessToken, option)
    .cookie(refreshToken, option)
    .json(
        new ApiResponse(
            200,
            {
                user: accessToken, refreshToken, logedinUser
            },
            "user login successfully"
        )
    )
    
})

const logoutUser = asyncHandler(async(req,res)=>{
     await User.findByIdAndUpdate(req.user._id, {$set:{refreshToken:undefined}},{new:true})

     const option= {
      httpOnly:true,
      secure:true
  }

  return res
  .status(200)
  .clearCookie("accessToken", option)
  .clearCookie("refreshToken", option)
  .json(new ApiResponse(200,{}, "user logout successfully"))
})

export { registerUser, loginUser , logoutUser};
