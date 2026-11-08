// flair-metal-hash: 08293b1b
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
    float3 uInk;
    packed_float3 uPaper;
    float uLines;
    float uHold;
    float uFps;
    float uPunch;
    uint uDemo;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_impact_frame_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 hitAt(thread const int& i, thread const bool& demo, thread const float& every, constant FlairUniforms& _125)
{
    bool _113 = !demo;
    bool _134;
    if (!_113)
    {
        _134 = _125.iClicks[0].w > 0.5;
    }
    else
    {
        _134 = _113;
    }
    if (_134)
    {
        return _125.iClicks[i];
    }
    float k = floor(_125.iTime / every) - float(i);
    float2 param = float2((k * 1.37000000476837158203125) + 0.5, 3.7000000476837158203125);
    float2 h = hash22(param);
    return float4((float2(0.300000011920928955078125) + (h * 0.4000000059604644775390625)) * float2(_125.iResolution[0], _125.iResolution[1]), k * every, 1.0);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _125)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_125.uBackdrop) * _125.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_125.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _125)
{
    float4 _322;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _322 = overBackdrop(param, _125);
    }
    else
    {
        float2 param_1 = fract(uv);
        _322 = float4(testCard(param_1), 1.0);
    }
    return _322;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _125, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_125.iResolution[0], _125.iResolution[1]);
    int param = 0;
    bool param_1 = _125.uDemo != 0u;
    float param_2 = 2.400000095367431640625;
    float4 c = hitAt(param, param_1, param_2, _125);
    float _363;
    if (c.w > 0.5)
    {
        _363 = _125.iTime - c.z;
    }
    else
    {
        _363 = 99.0;
    }
    float age = _363;
    float2 _378;
    if (c.w > 0.5)
    {
        _378 = c.xy / float2(_125.iResolution[0], _125.iResolution[1]);
    }
    else
    {
        _378 = float2(0.5);
    }
    float2 hit = _378;
    float frame = floor(fast::max(age, 0.0) * _125.uFps);
    float held = frame / _125.uFps;
    float on = step(0.0, age) * step(held, _125.uHold);
    float _418;
    if (age > _125.uHold)
    {
        _418 = exp((-(age - _125.uHold)) * 9.0);
    }
    else
    {
        _418 = 1.0;
    }
    float recover = _418;
    float k = (age >= 0.0) ? recover : 0.0;
    float2 param_3 = float2(frame, c.z);
    float2 jolt = ((hash22(param_3) - float2(0.5)) * 0.01200000010430812835693359375) * on;
    float2 st = (hit + ((uv - hit) / float2(1.0 + (_125.uPunch * k)))) + jolt;
    float2 param_4 = st;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_4, _125);
    float3 col = pic.xyz;
    if (on > 0.5)
    {
        float lum = dot(col, float3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625));
        int _490;
        if (_125.uMode == 2)
        {
            _490 = int(mod(frame, 2.0));
        }
        else
        {
            _490 = _125.uMode;
        }
        int look = _490;
        if (look == 0)
        {
            col = fast::clamp((((float3(1.0) - col) - float3(0.5)) * 1.7999999523162841796875) + float3(0.5), float3(0.0), float3(1.0));
        }
        else
        {
            col = mix(_125.uInk, float3(_125.uPaper), float3(smoothstep(0.4000000059604644775390625, 0.5, lum)));
        }
        float2 d = (uv - hit) * float2(_125.iResolution[0u] / _125.iResolution[1u], 1.0);
        float r = length(d);
        float a = (precise::atan2(d.y, d.x) / 6.28318023681640625) + 0.5;
        float n = 180.0;
        float cell = floor(a * n);
        float2 param_5 = float2(cell, frame + (c.z * 7.0));
        float h = hash12(param_5);
        float inLine = abs(fract(a * n) - 0.5) * 2.0;
        float thick = 0.1500000059604644775390625 + (0.699999988079071044921875 * h);
        float2 param_6 = float2(cell + 3.0, frame);
        float start = 0.180000007152557373046875 + (0.3499999940395355224609375 * hash12(param_6));
        float line = (step(1.0 - (_125.uLines * 0.89999997615814208984375), h) * step(inLine, thick)) * smoothstep(start, start + 0.1500000059604644775390625, r);
        float3 _615;
        if (look == 0)
        {
            _615 = float3(1.0) - _125.uInk;
        }
        else
        {
            _615 = _125.uInk;
        }
        float3 lineCol = _615;
        col = mix(col, lineCol, float3(line));
        if (frame < 0.5)
        {
            col = mix(float3(_125.uPaper), col, float3(0.1500000059604644775390625));
        }
        pic.w = 1.0;
    }
    else
    {
        if (age >= 0.0)
        {
            col = mix(col, fast::clamp(((col - float3(0.5)) * 1.2999999523162841796875) + float3(0.579999983310699462890625), float3(0.0), float3(1.0)), float3(k));
        }
    }
    fragColor = float4(col, pic.w);
}

fragment flair_impact_frame_frag_out flair_impact_frame_frag(constant FlairUniforms& _125 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_impact_frame_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _679;
    if (_125.flair_flipY > 0.5)
    {
        _679 = _125.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _679 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _679);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _125, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

