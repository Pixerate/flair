// flair-metal-hash: e654fa6f
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    int uMode;
    float uRoll;
    float uBar;
    float uTear;
    float uScanlines;
    float uNoise;
    char _m19_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_vertical_roll_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _92)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_92.uBackdrop) * _92.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_92.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _92)
{
    float4 _234;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _234 = overBackdrop(param, _92);
    }
    else
    {
        float2 param_1 = fract(uv);
        _234 = float4(testCard(param_1), 1.0);
    }
    return _234;
}

static inline __attribute__((always_inline))
float scanlines(thread const float& y, thread const float& amount)
{
    return 1.0 - ((amount * 0.5) * (1.0 - cos(y * 3.141590118408203125)));
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _92, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_92.iResolution[0], _92.iResolution[1]);
    float offset;
    float speed;
    if (_92.uMode == 1)
    {
        float rolls = fast::max(1.0, floor((_92.uRoll * 3.0) + 0.5));
        float c = mod(_92.iTime, 5.0);
        float u = fast::clamp(c / 3.0, 0.0, 1.0);
        offset = rolls * (1.0 - ((1.0 - u) * (1.0 - u)));
        speed = ((2.0 * rolls) / 3.0) * (1.0 - u);
    }
    else
    {
        offset = _92.iTime * _92.uRoll;
        speed = _92.uRoll;
    }
    float y = fract(uv.y - offset);
    float inBar = 1.0 - step(_92.uBar, y);
    float v = (y - _92.uBar) / (1.0 - _92.uBar);
    float pull = 1.0 - smoothstep(0.0, 0.3499999940395355224609375, v);
    float x = uv.x + ((_92.uTear * fast::min(speed, 1.5)) * (((0.039999999105930328369140625 * pull) * sin((v * 18.0) + (_92.iTime * 4.0))) + (0.006000000052154064178466796875 * sin((uv.y * 40.0) + (_92.iTime * 9.0)))));
    float2 param = float2(fract(x), fast::clamp(v, 0.0, 1.0));
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _92);
    float3 col = pic.xyz * (1.0 + ((0.1500000059604644775390625 * fast::min(speed, 1.0)) * pull));
    float param_1 = fragCoord.y;
    float param_2 = _92.uScanlines;
    col *= scanlines(param_1, param_2);
    float frame = floor(_92.iTime * 30.0);
    float2 param_3 = float2(floor(fragCoord.y * 0.5), frame);
    col += float3(((_92.uNoise * 0.25) * (hash12(param_3) - 0.5)) * fast::min(speed + 0.300000011920928955078125, 1.0));
    float2 param_4 = fragCoord + float2(frame);
    col += float3((_92.uNoise * 0.119999997317790985107421875) * (hash12(param_4) - 0.5));
    float2 param_5 = float2(floor(uv.x * 60.0), 1.0);
    float3 barCol = float3(0.014999999664723873138427734375) + float3(((0.25 * step(0.550000011920928955078125, y / _92.uBar)) * step(y / _92.uBar, 0.699999988079071044921875)) * step(0.5, hash12(param_5)));
    float alpha = mix(pic.w, 1.0, inBar);
    fragColor = float4(fast::clamp(mix(col, barCol, float3(inBar)), float3(0.0), float3(1.0)), alpha);
}

fragment flair_vertical_roll_frag_out flair_vertical_roll_frag(constant FlairUniforms& _92 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_vertical_roll_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _514;
    if (_92.flair_flipY > 0.5)
    {
        _514 = _92.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _514 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _514);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _92, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

