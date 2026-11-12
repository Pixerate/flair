// flair-metal-hash: 3f541efa
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
    int uLayout;
    float uCell;
    uint uAnimate;
    float uProgress;
    float uMaxZoom;
    float uCenterX;
    float uCenterY;
    float uGap;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_image_subpixel_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _70)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_70.uBackdrop) * _70.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_70.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _70)
{
    float4 _214;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _214 = overBackdrop(param, _70);
    }
    else
    {
        float2 param_1 = fract(uv);
        _214 = float4(testCard(param_1), 1.0);
    }
    return _214;
}

static inline __attribute__((always_inline))
float box(thread const float2& p, thread const float2& h, thread const float& aa)
{
    float2 q = abs(p) - h;
    return fast::clamp(0.5 - (fast::max(q.x, q.y) / aa), 0.0, 1.0);
}

static inline __attribute__((always_inline))
float disc(thread const float2& p, thread const float& r, thread const float& aa)
{
    return fast::clamp(0.5 - ((length(p) - r) / aa), 0.0, 1.0);
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _70)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _70).xyz;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _70, texture2d<float> uImage, sampler uImageSmplr)
{
    float _273;
    if (_70.uAnimate != 0u)
    {
        _273 = smoothstep(0.1500000059604644775390625, 0.85000002384185791015625, 0.5 + (0.5 * cos((_70.iTime * 6.28318023681640625) / 8.0)));
    }
    else
    {
        _273 = _70.uProgress;
    }
    float k = _273;
    float z = exp(log(_70.uMaxZoom) * k);
    float2 centre = float2(_70.uCenterX, _70.uCenterY) * float2(_70.iResolution[0], _70.iResolution[1]);
    float2 p = ((fragCoord - centre) / float2(z)) + centre;
    float2 cell = floor(p / float2(_70.uCell));
    float2 f = (p / float2(_70.uCell)) - cell;
    float2 param = ((cell + float2(0.5)) * _70.uCell) / float2(_70.iResolution[0], _70.iResolution[1]);
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _70);
    float3 c = pic.xyz;
    float aa = 1.0 / (z * _70.uCell);
    float shrink = 1.0 - _70.uGap;
    float3 sub = float3(0.0);
    if (_70.uLayout == 0)
    {
        float i = fast::min(floor(f.x * 3.0), 2.0);
        float3 _384;
        if (i < 0.5)
        {
            _384 = float3(1.0, 0.0, 0.0);
        }
        else
        {
            _384 = select(float3(0.0, 0.0, 1.0), float3(0.0, 1.0, 0.0), bool3(i < 1.5));
        }
        float3 tint = _384;
        float2 q = float2((fract(f.x * 3.0) - 0.5) / 3.0, f.y - 0.5);
        float2 param_1 = q;
        float2 param_2 = float2(shrink / 6.0, shrink * 0.5);
        float param_3 = aa;
        float m = box(param_1, param_2, param_3);
        sub = (tint * (0.039999999105930328369140625 + (dot(c, tint) * 2.2000000476837158203125))) * m;
    }
    else
    {
        if (_70.uLayout == 1)
        {
            float2 q_1 = f - float2(0.2700000107288360595703125, 0.5);
            bool red = mod(cell.x + cell.y, 2.0) < 1.0;
            float3 tint_1 = select(float3(0.0, 0.0, 1.0), float3(1.0, 0.0, 0.0), bool3(red));
            float diamond = fast::clamp(0.5 - (((abs(q_1.x) + abs(q_1.y)) - (0.23999999463558197021484375 * shrink)) / aa), 0.0, 1.0);
            float2 param_4 = f - float2(0.7599999904632568359375, 0.5);
            float param_5 = 0.1500000059604644775390625 * shrink;
            float param_6 = aa;
            float green = disc(param_4, param_5, param_6);
            sub = ((tint_1 * (0.039999999105930328369140625 + (dot(c, tint_1) * 2.400000095367431640625))) * diamond) + (float3(0.0, 0.039999999105930328369140625 + (c.y * 2.0), 0.0) * green);
        }
        else
        {
            float2 g = float2((p.x / _70.uCell) + (0.5 * mod(cell.y, 2.0)), p.y / _70.uCell);
            float2 tc = floor(g);
            float2 tf = g - tc;
            float2 param_7 = ((tc + float2(0.5)) * _70.uCell) / float2(_70.iResolution[0], _70.iResolution[1]);
            float3 tcol = picture(uImage, uImageSmplr, param_7, _70);
            float r = 0.20999999344348907470703125 * shrink;
            float2 param_8 = tf - float2(0.25, 0.300000011920928955078125);
            float param_9 = r;
            float param_10 = aa;
            float2 param_11 = tf - float2(0.75, 0.300000011920928955078125);
            float param_12 = r;
            float param_13 = aa;
            float2 param_14 = tf - float2(0.5, 0.75);
            float param_15 = r;
            float param_16 = aa;
            sub = (((float3(1.0, 0.0, 0.0) * (0.039999999105930328369140625 + (tcol.x * 2.400000095367431640625))) * disc(param_8, param_9, param_10)) + ((float3(0.0, 1.0, 0.0) * (0.039999999105930328369140625 + (tcol.y * 2.400000095367431640625))) * disc(param_11, param_12, param_13))) + ((float3(0.0, 0.0, 1.0) * (0.039999999105930328369140625 + (tcol.z * 2.400000095367431640625))) * disc(param_14, param_15, param_16));
        }
    }
    sub = mix(float3(0.014999999664723873138427734375), fast::min(sub, float3(1.0)), float3(fast::clamp(length(sub) * 8.0, 0.0, 1.0)));
    float resolve = smoothstep(1.5, 5.0, (z * _70.uCell) / 3.0);
    fragColor = float4(mix(c, sub, float3(resolve)), pic.w);
}

fragment flair_image_subpixel_frag_out flair_image_subpixel_frag(constant FlairUniforms& _70 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_image_subpixel_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _636;
    if (_70.flair_flipY > 0.5)
    {
        _636 = _70.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _636 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _636);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _70, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

